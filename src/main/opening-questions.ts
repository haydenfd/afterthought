import type { EntryStorage } from './entry-storage';
import { callGroq } from './groq-client';
import { JOURNAL_MEMORY_CONTAINER, type SupermemoryClient } from './supermemory-client';
import type { PreferencesStorage } from './preferences-storage';
import type { OpeningQuestionsBundle } from '../shared/reflection';
import type { JournalEntry } from '../shared/journal-entry';

const recentEntryLimit = 4;
const relevantMemoryLimit = 5;

const systemPrompt = `You are a reflective presence for someone's private journal — like a therapist who has been quietly listening for weeks, not an AI assistant. Using the context you're given below, write two short opening questions for today's journal entry: a primary question and an alternate.

Each question must:
- follow an ongoing experiment or habit the person is in the middle of, revisit a thread they left unresolved, or notice a pattern that's evolving over time
- reference something concrete and specific from their recent entries or memories
- when following an experiment, intention, or habit, ask what changed, surprised them, or became noticeable rather than merely checking whether it still works
- be warm and curious, never clinical
- never give advice, never diagnose, and never use generic therapeutic language like "how does that make you feel"
- avoid yes/no phrasing and task-follow-up framing; do not start with check-ins such as "Does", "Did", "Have", or "Is"
- avoid one-off errands or logistics unless they clearly became meaningful to the person
- avoid repeating a question that was already asked recently, if that's shown in the context
- be a single sentence, under 30 words

The primary and alternate questions should take genuinely different angles (e.g. one following up on a recent thread, one noticing a longer pattern) — not two versions of the same question.

Respond with ONLY a JSON object in exactly this shape, nothing else:
{"primaryQuestion": "...", "alternateQuestion": "...", "reason": "one short sentence on why these were chosen", "sourceMemoryIds": ["id1", "id2"]}
sourceMemoryIds should list the ids (given to you in the context below) of the memories that most directly informed the questions — omit ids that weren't actually used.`;

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

  const response = await callGroq(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    { jsonMode: true },
  );

  if (!response) {
    return null;
  }

  return parseBundle(response);
}

interface RetrievedMemory {
  id: string;
  text: string;
}

async function retrieveRelevantMemories(
  client: SupermemoryClient,
  recentEntries: JournalEntry[],
): Promise<RetrievedMemory[]> {
  const query = recentEntries
    .map((entry) => entry.content)
    .join('\n\n')
    .slice(0, 2000);

  if (!query.trim()) {
    return [];
  }

  try {
    const response = await client.search.memories({
      q: query,
      containerTag: JOURNAL_MEMORY_CONTAINER,
      limit: relevantMemoryLimit,
      rerank: true,
    });

    return response.results
      .filter(
        (result): result is typeof result & { memory: string } =>
          typeof result.memory === 'string' && result.memory.trim().length > 0,
      )
      .map((result) => ({ id: result.id, text: result.memory }));
  } catch {
    return [];
  }
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
  relevantMemories: RetrievedMemory[],
  userName: string | undefined,
): string {
  const parts: string[] = [];

  if (userName) {
    parts.push(`Their name is ${userName}.`);
  }

  parts.push(
    'Their most recent journal entries, newest first (this is their canonical recent history):',
    ...recentEntries.map(
      (entry) =>
        `- [${entry.createdAt.slice(0, 10)}] Prompt: "${entry.prompt}" — ${entry.content}`,
    ),
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
      ...relevantMemories.map((memory) => `- [id: ${memory.id}] ${memory.text}`),
    );
  }

  return parts.join('\n');
}

function parseBundle(response: string): OpeningQuestionsBundle | null {
  const jsonText = extractJsonObject(response);

  if (!jsonText) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(jsonText);

    if (!isValidGroqBundle(parsed)) {
      return null;
    }

    return {
      primaryQuestion: parsed.primaryQuestion,
      alternateQuestion: parsed.alternateQuestion,
      reason: parsed.reason,
      sourceMemoryIds: parsed.sourceMemoryIds,
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function isValidGroqBundle(value: unknown): value is {
  primaryQuestion: string;
  alternateQuestion: string;
  reason: string;
  sourceMemoryIds: string[];
} {
  const record = asRecord(value);

  if (!record) {
    return false;
  }

  return (
    typeof record.primaryQuestion === 'string' &&
    record.primaryQuestion.trim().length > 0 &&
    typeof record.alternateQuestion === 'string' &&
    record.alternateQuestion.trim().length > 0 &&
    typeof record.reason === 'string' &&
    Array.isArray(record.sourceMemoryIds) &&
    record.sourceMemoryIds.every((id) => typeof id === 'string')
  );
}

function extractJsonObject(value: string): string | null {
  const start = value.indexOf('{');
  const end = value.lastIndexOf('}');

  if (start === -1 || end === -1 || end < start) {
    return null;
  }

  return value.slice(start, end + 1);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}
