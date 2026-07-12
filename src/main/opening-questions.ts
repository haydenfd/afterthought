import type { EntryStorage } from './entry-storage';
import { callGroq } from './groq-client';
import { JOURNAL_MEMORY_CONTAINER, type SupermemoryClient } from './supermemory-client';
import type { PreferencesStorage } from './preferences-storage';
import type { OpeningQuestions, OpeningQuestionsBundle } from '../shared/reflection';
import type { JournalEntry } from '../shared/journal-entry';

const recentEntryLimit = 4;
const relevantMemoryLimit = 5;

const systemPrompt = `You are a reflective presence for someone's private journal — like a thoughtful companion who has been quietly listening for weeks, not an AI assistant. Using the context below, write exactly two complementary opening questions for today's journal entry.

The first question must follow up on a recent experiment, habit, or unresolved thread. Ask what changed, surprised them, or became noticeable — never merely whether it still works.

The second question must zoom out to a broader pattern, value, or emotional theme. It should offer a noticeably different lens from the first, not a rewording.

Each question must be a single warm, curious sentence under 30 words. Guide writing rather than interrogating the person. Avoid yes/no phrasing, advice, diagnosis, clichés, generic therapy language, one-off logistics, and task-follow-up framing.

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
  const jsonText = extractJsonArray(response);

  if (!jsonText) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(jsonText);

    if (!isOpeningQuestions(parsed)) {
      return null;
    }

    return {
      questions: parsed,
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
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
    countWords(secondQuestion) > 30
  ) {
    return false;
  }

  return (
    firstQuestion.trim().toLocaleLowerCase() !==
    secondQuestion.trim().toLocaleLowerCase()
  );
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
