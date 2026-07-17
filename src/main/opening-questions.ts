import type { EntryStorage } from './entry-storage';
import { callGroq } from './groq-client';
import { retrieveMemoryEvidence } from './memory-evidence';
import type { PreferencesStorage } from './preferences-storage';
import type {
  MemoryEvidenceItem,
  OpeningQuestions,
  OpeningQuestionsBundle,
} from '../shared/reflection';
import { JOURNAL_MEMORY_CONTAINER, type SupermemoryClient } from './supermemory-client';
import type { JournalEntry } from '../shared/journal-entry';

const recentEntryLimit = 4;
const relevantMemoryLimit = 5;
const minimumMemorySimilarity = 0.58;

const systemPrompt = `You are a reflective presence for someone's private journal — like a thoughtful companion who has been quietly listening for weeks, not an AI assistant. Using the context below, write exactly two complementary opening questions for today's journal entry.

The first question must follow up on a recent experiment, habit, or unresolved thread. Ask what changed, surprised them, or became noticeable — never merely whether it still works.

The second question must zoom out to a broader pattern, value, or emotional theme. It should offer a noticeably different lens from the first, not a rewording.

Each question must be a single warm, curious sentence under 30 words. Guide writing rather than interrogating the person. Avoid yes/no phrasing, advice, diagnosis, clichés, generic therapy language, one-off logistics, and task-follow-up framing. Do not repeat a recently asked question.

Retrieved memories are optional evidence, not facts you must mention. One match is not a pattern. Use recurrence language only when at least two distinct recent journal entries or verified source documents support it, and stay with recent writing when older context is weak.

Generated questions in the history are prompts, not memories or answers. Never infer that someone addressed a prompt unless their authored response says so.

Respond with ONLY a JSON array of exactly two strings, nothing else:
["first question", "second question"]`;

export async function generateOpeningQuestions(
  entryStorage: EntryStorage,
  clientPromise: Promise<SupermemoryClient>,
  preferences: PreferencesStorage,
): Promise<OpeningQuestionsBundle | null> {
  const recentEntries = (await entryStorage.listEntries()).slice(0, recentEntryLimit);

  if (recentEntries.length === 0) {
    return null;
  }

  const client = await clientPromise.catch(() => null);

  const [profileResult, memoriesResult] = client
    ? await Promise.allSettled([
        client.profile({ containerTag: JOURNAL_MEMORY_CONTAINER }),
        retrieveRelevantMemories(client, recentEntries),
      ])
    : [];

  const profile =
    profileResult?.status === 'fulfilled' ? extractProfile(profileResult.value) : null;
  const relevantMemories =
    memoriesResult?.status === 'fulfilled' ? memoriesResult.value : [];

  const { userName } = await preferences.getPreferences();
  const userMessage = buildUserMessage(
    recentEntries,
    profile,
    relevantMemories,
    userName,
  );

  const response = await callGroq([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ]);

  if (!response) {
    return null;
  }

  const verifiedSourceDocuments = new Set(
    relevantMemories.flatMap((memory) => memory.sourceDocumentIds),
  );
  return parseBundle(
    response,
    recentEntries.length >= 2 || verifiedSourceDocuments.size >= 2,
    relevantMemories,
  );
}

async function retrieveRelevantMemories(
  client: SupermemoryClient,
  recentEntries: JournalEntry[],
): Promise<MemoryEvidenceItem[]> {
  const queries = recentEntries
    .slice(0, 2)
    .map((entry) =>
      [entry.themes?.join(', '), entry.content.slice(0, 1_400)]
        .filter(Boolean)
        .join(': '),
    );
  return retrieveMemoryEvidence(client, queries, {
    limit: relevantMemoryLimit,
    minimumSimilarity: minimumMemorySimilarity,
  }).then((memories) => memories.slice(0, relevantMemoryLimit));
}

function extractProfile(
  value: unknown,
): { static: string[]; dynamic: string[] } | null {
  const record = asRecord(value);
  const profile = asRecord(record?.profile);

  if (!profile) {
    return null;
  }

  return {
    static: stringArray(profile.static),
    dynamic: stringArray(profile.dynamic),
  };
}

function buildUserMessage(
  recentEntries: JournalEntry[],
  profile: { static: string[]; dynamic: string[] } | null,
  relevantMemories: MemoryEvidenceItem[],
  userName: string | undefined,
): string {
  const parts: string[] = [];

  if (userName) {
    parts.push(`Their name is ${userName}.`);
  }

  parts.push(
    'Their most recent journal entries, newest first (this is their canonical recent history):',
    ...recentEntries.map((entry) => {
      const followUp = entry.deeperReflection?.response?.trim();
      const generatedPrompt = entry.deeperReflection
        ? ` Generated follow-up prompt (not an answer): "${entry.deeperReflection.question}"`
        : '';
      return `- [${entry.createdAt.slice(0, 10)}] Asked: "${entry.openingQuestions?.join('" / "') ?? entry.prompt}" — ${entry.content}${followUp ? ` Follow-up response: ${followUp}` : ''}${generatedPrompt}${entry.themes?.length ? ` Themes: ${entry.themes.join(', ')}.` : ''}`;
    }),
  );

  const profileLines = [...(profile?.dynamic ?? []), ...(profile?.static ?? [])];
  if (profileLines.length > 0) {
    parts.push(
      'A synthesized profile of who they are:',
      ...profileLines.map((line) => `- ${line}`),
    );
  }

  if (relevantMemories.length > 0) {
    parts.push(
      'Older memories that are semantically related to what they have been writing about recently (each has an id for citation):',
      ...relevantMemories.map(
        (memory) =>
          `- [id: ${memory.id}; relevance: ${memory.similarity.toFixed(2)}] ${memory.text}`,
      ),
    );
  }

  return parts.join('\n');
}

function parseBundle(
  response: string,
  canSupportRecurrence: boolean,
  sourceMemories: MemoryEvidenceItem[],
): OpeningQuestionsBundle | null {
  const jsonText = extractJsonArray(response);

  if (!jsonText) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(jsonText);

    if (
      !isOpeningQuestions(parsed) ||
      (!canSupportRecurrence && parsed.some(hasRecurrenceClaim))
    ) {
      return null;
    }

    return {
      questions: parsed,
      generatedAt: new Date().toISOString(),
      ...(sourceMemories.length === 0 ? {} : { sourceMemories }),
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

function isOpeningQuestions(value: unknown): value is OpeningQuestions {
  if (!Array.isArray(value) || value.length !== 2) {
    return false;
  }

  const firstQuestion: unknown = value[0];
  const secondQuestion: unknown = value[1];
  if (
    typeof firstQuestion !== 'string' ||
    typeof secondQuestion !== 'string' ||
    firstQuestion.trim().length === 0 ||
    secondQuestion.trim().length === 0 ||
    countWords(firstQuestion) > 30 ||
    countWords(secondQuestion) > 30 ||
    !isSingleQuestion(firstQuestion) ||
    !isSingleQuestion(secondQuestion)
  ) {
    return false;
  }

  return (
    firstQuestion.trim().toLocaleLowerCase() !==
    secondQuestion.trim().toLocaleLowerCase()
  );
}

function isSingleQuestion(value: string): boolean {
  const question = value.trim();
  return question.endsWith('?') && !/[?!.]/.test(question.slice(0, -1));
}

function extractJsonArray(value: string): string | null {
  const start = value.indexOf('[');
  const end = value.lastIndexOf(']');

  if (start === -1 || end === -1 || end < start) {
    return null;
  }

  return value.slice(start, end + 1);
}

function countWords(value: string): number {
  return value.trim().split(/\s+/).length;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}
