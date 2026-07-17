import { callGroq } from './groq-client';
import type {
  MemoryItem,
  MemoryProfile,
  MemoryThread,
  MemoryThreadKind,
} from '../shared/memory';

const maximumThreads = 4;
const maximumQuestionWords = 28;
const allowedKinds: MemoryThreadKind[] = [
  'present',
  'unresolved',
  'shifting',
  'steady',
  'progress',
];

const systemPrompt = `You are an evidence-bound reflection editor for a private journaling app.

Turn the supplied Supermemory evidence into up to four useful threads a person may notice. A thread is not a diagnosis, personality verdict, or instruction. Use only the supplied memory text. A single source entry is a moment, not a recurring pattern. Only describe something as recurring or steady when the supporting memories come from at least two distinct source entries.

Each thread needs a short title, a grounded summary, a kind, the ids of the memories that support it, and optionally one gentle next question. Never invent dates, counts, causes, certainty, or source ids. Do not repeat the entire memory text. Keep the language warm, plain, and non-clinical.

Return ONLY this JSON object:
{"threads":[{"id":"short-id","title":"short title","summary":"grounded summary","kind":"present|unresolved|shifting|steady|progress","sourceMemoryIds":["memory-id"],"nextQuestion":"optional question"}]}`;

export async function generateMemoryThreads(
  memories: MemoryItem[],
  profile: MemoryProfile,
): Promise<MemoryThread[]> {
  if (memories.length === 0) {
    return [];
  }

  const response = await callGroq(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: buildContext(memories, profile) },
    ],
    { jsonMode: true, temperature: 0.25, maxTokens: 900, timeoutMs: 4_000 },
  );

  if (!response) {
    return [];
  }

  return parseThreads(response, memories);
}

function buildContext(memories: MemoryItem[], profile: MemoryProfile): string {
  const profileLines = [...profile.dynamic, ...profile.static];
  const parts = [
    'Supermemory evidence, each item is a sourceable memory:',
    ...memories.slice(0, 24).map((memory) => {
      const sourceEntries = memory.sourceEntryIds?.join(', ') || 'unresolved';
      const sourceDate = memory.sourceDate ? `; date: ${memory.sourceDate}` : '';
      return `- [id: ${memory.id}; source entries: ${sourceEntries}${sourceDate}] ${memory.text}`;
    }),
  ];

  if (profileLines.length > 0) {
    parts.push(
      'Existing Supermemory profile context. Use it only to organize the evidence, not as a new source:',
      ...profileLines.slice(0, 8).map((line) => `- ${line}`),
    );
  }

  return parts.join('\n');
}

function parseThreads(response: string, memories: MemoryItem[]): MemoryThread[] {
  const jsonText = extractJsonObject(response);
  if (!jsonText) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(jsonText);
    if (!parsed || typeof parsed !== 'object') {
      return [];
    }

    const rawThreads = (parsed as Record<string, unknown>).threads;
    if (!Array.isArray(rawThreads)) {
      return [];
    }

    const memoryMap = new Map(memories.map((memory) => [memory.id, memory]));
    const threads: MemoryThread[] = [];
    for (const [index, value] of rawThreads.slice(0, maximumThreads).entries()) {
      const thread = parseThread(value, memoryMap, index);
      if (thread) {
        threads.push(thread);
      }
    }

    return threads;
  } catch {
    return [];
  }
}

function parseThread(
  value: unknown,
  memoryMap: Map<string, MemoryItem>,
  index: number,
): MemoryThread | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const title = stringValue(record.title);
  const summary = stringValue(record.summary);
  const kind = record.kind;
  const sourceMemoryIds = stringArray(record.sourceMemoryIds).filter((id) =>
    memoryMap.has(id),
  );
  if (
    !title ||
    !summary ||
    !sourceMemoryIds.length ||
    typeof kind !== 'string' ||
    !allowedKinds.includes(kind as MemoryThreadKind)
  ) {
    return null;
  }

  const sourceEntryIds = unique(
    sourceMemoryIds.flatMap((id) => memoryMap.get(id)?.sourceEntryIds ?? []),
  );
  if (
    (kind === 'steady' || hasPatternLanguage(`${title} ${summary}`)) &&
    sourceEntryIds.length < 2
  ) {
    return null;
  }
  const nextQuestion = parseQuestion(record.nextQuestion);
  const id = slug(stringValue(record.id) ?? `thread-${index + 1}`);

  return {
    id,
    title: title.slice(0, 64),
    summary: summary.slice(0, 280),
    kind: kind as MemoryThreadKind,
    sourceMemoryIds: unique(sourceMemoryIds),
    sourceEntryIds,
    ...(nextQuestion ? { nextQuestion } : {}),
  };
}

function hasPatternLanguage(value: string): boolean {
  return /\b(recurring|recurs|often|frequent\w*|usually|repeated\w*|pattern|over time|consistently)\b/i.test(
    value,
  );
}

function extractJsonObject(value: string): string | null {
  const start = value.indexOf('{');
  const end = value.lastIndexOf('}');
  return start === -1 || end < start ? null : value.slice(start, end + 1);
}

function parseQuestion(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const question = value.trim();
  const wordCount = question.split(/\s+/).filter(Boolean).length;
  if (
    wordCount < 5 ||
    wordCount > maximumQuestionWords ||
    !question.endsWith('?') ||
    /[?!.]/.test(question.slice(0, -1)) ||
    /^(do|did|does|is|are|was|were|can|could|will|would|have|has|had)\b/i.test(question)
  ) {
    return undefined;
  }

  return question;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function slug(value: string): string {
  const normalized = value
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  return normalized || 'thread';
}
