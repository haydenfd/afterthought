import type { JournalEntry } from '../shared/journal-entry';
import {
  reflectionStrategies,
  type DeeperQuestionInput,
  type DeeperQuestionResult,
  type ReflectionStrategy,
} from '../shared/reflection';
import type { EntryStorage } from './entry-storage';
import { callGroq } from './groq-client';
import { inferFallbackThemes, normalizeThemes } from './reflection-themes';
import { JOURNAL_MEMORY_CONTAINER, type SupermemoryClient } from './supermemory-client';

const recentEntryLimit = 6;
const queryLimit = 2;
const resultLimit = 4;
const minimumEvidenceSimilarity = 0.58;
const maximumQuestionWords = 28;

interface ReflectionPlan {
  focus: string;
  signals: string[];
  themes: string[];
  retrievalQueries: string[];
  candidateStrategies: ReflectionStrategy[];
}

interface MemoryEvidence {
  id: string;
  text: string;
  similarity: number;
  sourceDocumentIds: string[];
}

const planningPrompt = `Interpret a private journal response so another model can ask one useful follow-up question. Return a compact plan, not advice and not a question.

Prioritize reflection-worthy signals: recurring emotions, habits being tested, motivation, uncertainty, confidence, identity, relationships, values, creativity, learning, coping, avoidance, decisions, unresolved tension, progress, contradiction, and repeated intentions. Treat tasks and logistics only as possible evidence about attention, motivation, behavior, or emotional effect.

Infer up to five short, flexible themes grounded in the writing. Write zero to two targeted retrieval queries only when older context could materially improve the question. A query should name the underlying experience or thread, not repeat the entire entry.

Return ONLY this JSON object:
{"focus":"short grounded summary","signals":["signal"],"themes":["theme"],"retrievalQueries":["query"],"candidateStrategies":["strategy"]}

Allowed strategies: ${reflectionStrategies.join(', ')}.`;

const questionPrompt = `Write exactly one concise follow-up question for a guided reflection session. Return structured JSON only.

The question must be one natural sentence under 29 words. It must deepen the person's own writing without advice, diagnosis, clinical language, a preamble, yes-or-no framing, or generic wording such as "How does that make you feel?" Do not repeat either opening question or a recently asked question.

Tasks and goals are allowed as context, but explore the experience, motivation, belief, avoidance, attention, or recurring behavior around them. Never act like a task manager.

Memory evidence is optional. Similarity does not prove significance. Stay entirely with the current response when evidence is weak. A single memory can support "Earlier you wrote" or "This seems related to," but never a pattern. Language such as "a few times," "recurring," or "often" requires evidence tied to at least two distinct verified source entries. Multiple extracted memories from one source entry still count as one source. Never fabricate counts, dates, trends, or certainty.

Return ONLY this JSON object:
{"question":"one question","strategy":"allowed strategy","sourceMemoryIds":["only ids actually used"]}`;

export async function generateDeeperQuestion(
  entryStorage: EntryStorage,
  clientPromise: Promise<SupermemoryClient>,
  input: DeeperQuestionInput,
): Promise<DeeperQuestionResult> {
  const initialResponse = input.initialResponse.trim();
  const recentEntries = (await entryStorage.listEntries()).slice(0, recentEntryLimit);
  const recentlyAsked = collectRecentQuestions(recentEntries);
  const fallbackThemes = inferFallbackThemes(initialResponse);

  const planResponse = await callGroq(
    [
      { role: 'system', content: planningPrompt },
      {
        role: 'user',
        content: buildPlanningContext(input, recentEntries),
      },
    ],
    { jsonMode: true, temperature: 0.25, maxTokens: 350 },
  );
  const plan = planResponse ? parsePlan(planResponse) : null;

  if (!plan) {
    return fallbackResult(input, fallbackThemes);
  }

  const client = await clientPromise.catch(() => null);
  const [evidence, profile] = client
    ? await Promise.all([
        retrieveEvidence(client, plan.retrievalQueries),
        retrieveProfile(client),
      ])
    : [[], null];

  const questionResponse = await callGroq(
    [
      { role: 'system', content: questionPrompt },
      {
        role: 'user',
        content: buildQuestionContext(
          input,
          plan,
          recentEntries,
          recentlyAsked,
          evidence,
          profile,
        ),
      },
    ],
    { jsonMode: true, temperature: 0.55, maxTokens: 220 },
  );
  const generated = questionResponse
    ? parseGeneratedQuestion(questionResponse, input, recentlyAsked, evidence)
    : null;
  const themes = plan.themes.length > 0 ? normalizeThemes(plan.themes) : fallbackThemes;

  return generated
    ? { ...generated, themes, source: 'ai' }
    : fallbackResult(input, themes);
}

function buildPlanningContext(
  input: DeeperQuestionInput,
  recentEntries: JournalEntry[],
): string {
  const parts = [
    'Opening questions:',
    ...input.openingQuestions.map((question) => `- ${question}`),
    'Current response:',
    input.initialResponse.slice(0, 8_000),
  ];

  if (recentEntries.length > 0) {
    parts.push(
      'Recent completed reflections (use only to plan useful retrieval):',
      ...recentEntries.map(formatRecentEntry),
    );
  }

  return parts.join('\n');
}

function buildQuestionContext(
  input: DeeperQuestionInput,
  plan: ReflectionPlan,
  recentEntries: JournalEntry[],
  recentlyAsked: string[],
  evidence: MemoryEvidence[],
  profile: { static: string[]; dynamic: string[] } | null,
): string {
  const parts = [
    'Opening questions that must not be repeated:',
    ...input.openingQuestions.map((question) => `- ${question}`),
    'Current response (the primary evidence):',
    input.initialResponse.slice(0, 8_000),
    'Interpretation plan:',
    `- Focus: ${plan.focus}`,
    `- Signals: ${plan.signals.join('; ') || 'none identified'}`,
    `- Candidate strategies: ${plan.candidateStrategies.join(', ')}`,
  ];

  if (recentEntries.length > 0) {
    parts.push(
      'Recent completed reflections:',
      ...recentEntries.map(formatRecentEntry),
    );
  }
  if (recentlyAsked.length > 0) {
    parts.push(
      'Recently asked questions to avoid repeating:',
      ...recentlyAsked.map((question) => `- ${question}`),
    );
  }
  if (profile && profile.dynamic.length + profile.static.length > 0) {
    parts.push(
      'Cautious longitudinal profile (supporting context, not fact):',
      ...[...profile.dynamic, ...profile.static].map((line) => `- ${line}`),
    );
  }
  if (evidence.length > 0) {
    parts.push(
      'Candidate memory evidence. Use only when it adds a grounded connection:',
      ...evidence.map(
        (memory) =>
          `- [id: ${memory.id}; relevance: ${memory.similarity.toFixed(2)}; source entries: ${memory.sourceDocumentIds.join(', ') || 'unverified'}] ${memory.text}`,
      ),
    );
  } else {
    parts.push('No historical memory evidence was strong enough to include.');
  }

  return parts.join('\n');
}

function formatRecentEntry(entry: JournalEntry): string {
  const themes = entry.themes?.length ? ` Themes: ${entry.themes.join(', ')}.` : '';
  return `- [${entry.createdAt.slice(0, 10)}] ${entry.content.slice(0, 1_200)}${themes}`;
}

function collectRecentQuestions(entries: JournalEntry[]): string[] {
  return entries.flatMap((entry) => [
    ...(entry.openingQuestions ?? (entry.prompt ? [entry.prompt] : [])),
    ...(entry.deeperReflection ? [entry.deeperReflection.question] : []),
  ]);
}

async function retrieveEvidence(
  client: SupermemoryClient,
  queries: string[],
): Promise<MemoryEvidence[]> {
  const selectedQueries = queries.slice(0, queryLimit);
  if (selectedQueries.length === 0) {
    return [];
  }

  const responses = await Promise.allSettled(
    selectedQueries.map((query) =>
      client.search.memories({
        q: query,
        containerTag: JOURNAL_MEMORY_CONTAINER,
        limit: resultLimit,
        rerank: true,
        include: { documents: true },
      }),
    ),
  );
  const evidence = new Map<string, MemoryEvidence>();

  for (const response of responses) {
    if (response.status === 'rejected') {
      continue;
    }
    for (const result of response.value.results) {
      if (
        typeof result.memory !== 'string' ||
        !result.memory.trim() ||
        !Number.isFinite(result.similarity) ||
        result.similarity < minimumEvidenceSimilarity
      ) {
        continue;
      }

      const existing = evidence.get(result.id);
      const sourceDocumentIds = (result.documents ?? [])
        .map((document) => document.id)
        .filter(Boolean);
      if (!existing || result.similarity > existing.similarity) {
        evidence.set(result.id, {
          id: result.id,
          text: result.memory.trim(),
          similarity: result.similarity,
          sourceDocumentIds,
        });
      } else if (sourceDocumentIds.length > 0) {
        existing.sourceDocumentIds = [
          ...new Set([...existing.sourceDocumentIds, ...sourceDocumentIds]),
        ];
      }
    }
  }

  return [...evidence.values()]
    .sort((left, right) => right.similarity - left.similarity)
    .slice(0, resultLimit * queryLimit);
}

async function retrieveProfile(
  client: SupermemoryClient,
): Promise<{ static: string[]; dynamic: string[] } | null> {
  try {
    const value = await client.profile({ containerTag: JOURNAL_MEMORY_CONTAINER });
    const record = asRecord(value);
    const profile = asRecord(record?.profile);
    if (!profile) {
      return null;
    }

    return {
      static: stringArray(profile.static),
      dynamic: stringArray(profile.dynamic),
    };
  } catch {
    return null;
  }
}

function parsePlan(value: string): ReflectionPlan | null {
  try {
    const parsed = asRecord(JSON.parse(value));
    if (!parsed || typeof parsed.focus !== 'string' || !parsed.focus.trim()) {
      return null;
    }

    const candidateStrategies = stringArray(parsed.candidateStrategies).filter(
      (strategy): strategy is ReflectionStrategy =>
        reflectionStrategies.includes(strategy as ReflectionStrategy),
    );

    return {
      focus: parsed.focus.trim().slice(0, 240),
      signals: stringArray(parsed.signals)
        .map((signal) => signal.slice(0, 120))
        .slice(0, 6),
      themes: normalizeThemes(parsed.themes),
      retrievalQueries: stringArray(parsed.retrievalQueries)
        .map((query) => query.trim().slice(0, 180))
        .filter(Boolean)
        .slice(0, queryLimit),
      candidateStrategies:
        candidateStrategies.length > 0
          ? candidateStrategies.slice(0, 3)
          : ['deepen-current-thought'],
    };
  } catch {
    return null;
  }
}

function parseGeneratedQuestion(
  value: string,
  input: DeeperQuestionInput,
  recentlyAsked: string[],
  evidence: MemoryEvidence[],
): Omit<DeeperQuestionResult, 'themes' | 'source'> | null {
  try {
    const parsed = asRecord(JSON.parse(value));
    if (
      !parsed ||
      typeof parsed.question !== 'string' ||
      typeof parsed.strategy !== 'string' ||
      !reflectionStrategies.includes(parsed.strategy as ReflectionStrategy)
    ) {
      return null;
    }

    const question = parsed.question.trim();
    const excludedQuestions = [...input.openingQuestions, ...recentlyAsked];
    if (!isValidQuestion(question, excludedQuestions)) {
      return null;
    }

    const evidenceIds = new Set(evidence.map((memory) => memory.id));
    const sourceMemoryIds = stringArray(parsed.sourceMemoryIds).filter((id) =>
      evidenceIds.has(id),
    );
    const usedEvidence = evidence.filter((memory) =>
      sourceMemoryIds.includes(memory.id),
    );
    const verifiedSourceEntries = new Set(
      usedEvidence.flatMap((memory) => memory.sourceDocumentIds),
    );
    if (hasRecurrenceClaim(question) && verifiedSourceEntries.size < 2) {
      return null;
    }

    return {
      question,
      provenance: {
        strategy: parsed.strategy as ReflectionStrategy,
        sourceMemoryIds: [...new Set(sourceMemoryIds)],
      },
    };
  } catch {
    return null;
  }
}

function hasRecurrenceClaim(question: string): boolean {
  return /\b(a few times|several (?:times|entries)|recurr\w*|often|repeatedly|pattern)\b/i.test(
    question,
  );
}

function isValidQuestion(question: string, excludedQuestions: string[]): boolean {
  const wordCount = question.split(/\s+/).filter(Boolean).length;
  const questionBody = question.slice(0, -1);
  const normalized = normalizeQuestion(question);
  const yesNoOpening =
    /^(do|did|does|is|are|was|were|can|could|will|would|have|has|had)\b/i;

  return (
    wordCount >= 5 &&
    wordCount <= maximumQuestionWords &&
    question.endsWith('?') &&
    !/[?!.]/.test(questionBody) &&
    !yesNoOpening.test(question) &&
    !excludedQuestions.some((excluded) => normalizeQuestion(excluded) === normalized)
  );
}

function fallbackResult(
  input: DeeperQuestionInput,
  themes: string[],
): DeeperQuestionResult {
  const text = input.initialResponse;
  const taskLanguage =
    /\b(todo|task\w*|deadline\w*|email\w*|call\w*|appointment\w*|finish\w*|unfinished|postpon\w*|procrastinat\w*)\b/i;
  const positiveChange =
    /\b(excited|proud|progress\w*|better|energ\w*|learn\w*|creativ\w*|worked|improv\w*|achievement\w*)\b/i;
  const tension = /\b(but|although|however|conflict|torn|contradict|yet)\b/i;

  const question = taskLanguage.test(text)
    ? 'What seems to keep this unfinished thing present in your attention?'
    : positiveChange.test(text)
      ? 'What feels most worth remembering about what made this change possible?'
      : tension.test(text)
        ? 'What feels hardest to reconcile in what you just wrote?'
        : 'What feels most important to understand about what you just wrote?';

  return {
    question,
    themes: normalizeThemes(themes),
    source: 'fallback',
    provenance: {
      strategy: taskLanguage.test(text)
        ? 'connect-behavior-and-effect'
        : positiveChange.test(text)
          ? 'notice-progress'
          : tension.test(text)
            ? 'surface-contradiction'
            : 'deepen-current-thought',
      sourceMemoryIds: [],
    },
  };
}

function normalizeQuestion(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}
