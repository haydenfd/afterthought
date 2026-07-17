import { callGroq, isGroqConfigured } from './groq-client';
import { retrieveMemoryEvidence } from './memory-evidence';
import type { SupermemoryClient } from './supermemory-client';
import type { JournalEntry } from '../shared/journal-entry';
import type {
  MemoryEvidenceItem,
  TemporalMirrorResult,
  TemporalMirrorSection,
} from '../shared/reflection';

const maximumEvidence = 12;
const minimumSimilarity = 0.48;
const maximumSummaryLength = 420;
const maximumUnresolvedLength = 360;

const systemPrompt = `You are an evidence-bound temporal reflection editor for a private journaling app.

Answer the person's question by comparing earlier and later source moments from their journal. Do not write a generic summary. "Then" must use the earlier dated evidence and "Now" must use later dated evidence. Describe only what the supplied text supports. A change can be subtle or uncertain; do not invent causes, counts, diagnoses, intentions, or certainty.

Write a concise summary for Then and Now, explain what seems to have shifted, and name what remains unresolved. Each Then and Now summary must cite one or more supplied memory ids. Use only the supplied ids. Keep the language warm, plain, and non-clinical.

Return ONLY this JSON object:
{"then":{"summary":"earlier experience","sourceMemoryIds":["memory-id"]},"now":{"summary":"later experience","sourceMemoryIds":["memory-id"]},"shifted":"what seems different","unresolved":"what remains open"}`;

export async function generateTemporalMirror(
  clientPromise: Promise<SupermemoryClient>,
  rawQuery: string,
  entries: JournalEntry[] = [],
): Promise<TemporalMirrorResult> {
  const query = rawQuery.trim().slice(0, 240);
  if (!query) {
    return {
      status: 'insufficient',
      query: '',
      message: 'Ask a question about something you want to understand across time.',
    };
  }

  if (!isGroqConfigured()) {
    return {
      status: 'unavailable',
      query,
      message: 'Add a Groq key in Settings to compare remembered moments across time.',
    };
  }

  let client: SupermemoryClient;
  try {
    client = await clientPromise;
  } catch {
    return {
      status: 'unavailable',
      query,
      message:
        'Supermemory Local is unavailable, so there are no source moments to compare.',
    };
  }

  let evidence: MemoryEvidenceItem[];
  try {
    evidence = await retrieveMemoryEvidence(
      client,
      [
        query,
        `Earlier journal moments related to: ${query}`,
        `Recent journal moments related to: ${query}`,
      ],
      { limit: maximumEvidence, minimumSimilarity },
    );
  } catch {
    return {
      status: 'unavailable',
      query,
      message:
        'The journal could not be searched right now. Try the mirror again in a moment.',
    };
  }

  const enrichedEvidence = enrichEvidence(evidence, entries);
  if (!hasTemporalEvidence(enrichedEvidence)) {
    return {
      status: 'insufficient',
      query,
      message:
        'There are not yet two dated source moments about this. Write another entry or try a broader question.',
    };
  }

  const response = await callGroq(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: buildContext(query, enrichedEvidence) },
    ],
    { jsonMode: true, temperature: 0.2, maxTokens: 900, timeoutMs: 6_000 },
  );

  if (!response) {
    return {
      status: 'unavailable',
      query,
      message:
        'The temporal reflection layer is unavailable right now. Try again shortly.',
    };
  }

  const mirror = parseTemporalMirror(response, enrichedEvidence);
  if (!mirror) {
    return {
      status: 'insufficient',
      query,
      message:
        'The available source moments did not support a grounded Then and Now comparison yet.',
    };
  }

  return {
    status: 'available',
    query,
    ...mirror,
    sourceMemories: enrichedEvidence,
  };
}

function buildContext(query: string, evidence: MemoryEvidenceItem[]): string {
  return [
    `Person's question: ${query}`,
    'Dated Supermemory source moments, ordered from earlier to later:',
    ...evidence
      .slice()
      .sort((left, right) => earliestDate(left) - earliestDate(right))
      .map((memory) => {
        const sourceEntries = memory.sourceEntryIds.join(', ') || 'unresolved';
        const sourceDocuments = memory.sourceDocumentIds.join(', ') || 'unresolved';
        const date = memory.sourceDate ?? 'undated';
        return `- [id: ${memory.id}; date: ${date}; source entries: ${sourceEntries}; source documents: ${sourceDocuments}] ${memory.text}`;
      }),
  ].join('\n');
}

function parseTemporalMirror(
  response: string,
  evidence: MemoryEvidenceItem[],
): {
  then: TemporalMirrorSection;
  now: TemporalMirrorSection;
  shifted: string;
  unresolved: string;
} | null {
  const jsonText = extractJsonObject(response);
  if (!jsonText) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(jsonText);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const record = parsed as Record<string, unknown>;
    const memoryMap = new Map(evidence.map((memory) => [memory.id, memory]));
    const then = parseSection(record.then, memoryMap);
    const now = parseSection(record.now, memoryMap);
    const shifted = boundedText(record.shifted, maximumSummaryLength);
    const unresolved = boundedText(record.unresolved, maximumUnresolvedLength);
    if (!then || !now || !shifted || !unresolved) {
      return null;
    }

    const thenDates = sourceDates(then.sourceMemoryIds, memoryMap);
    const nowDates = sourceDates(now.sourceMemoryIds, memoryMap);
    if (
      thenDates.length === 0 ||
      nowDates.length === 0 ||
      Math.max(...thenDates) >= Math.min(...nowDates) ||
      overlapsSourceMoments(then, now, memoryMap)
    ) {
      return null;
    }

    return { then, now, shifted, unresolved };
  } catch {
    return null;
  }
}

function parseSection(
  value: unknown,
  memoryMap: Map<string, MemoryEvidenceItem>,
): TemporalMirrorSection | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const summary = boundedText(record.summary, maximumSummaryLength);
  const sourceMemoryIds = stringArray(record.sourceMemoryIds).filter((id) =>
    memoryMap.has(id),
  );
  if (!summary || sourceMemoryIds.length === 0) {
    return null;
  }

  return {
    summary,
    sourceMemoryIds: unique(sourceMemoryIds),
    sourceEntryIds: unique(
      sourceMemoryIds.flatMap((id) => memoryMap.get(id)?.sourceEntryIds ?? []),
    ),
  };
}

function enrichEvidence(
  evidence: MemoryEvidenceItem[],
  entries: JournalEntry[],
): MemoryEvidenceItem[] {
  const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
  return evidence.map((memory) => {
    if (memory.sourceDate) {
      return memory;
    }

    const sourceDate = memory.sourceEntryIds
      .map((entryId) => entriesById.get(entryId)?.createdAt)
      .find((value): value is string => Boolean(value));
    return sourceDate ? { ...memory, sourceDate } : memory;
  });
}

function hasTemporalEvidence(evidence: MemoryEvidenceItem[]): boolean {
  const sourceKeys = new Set(
    evidence.flatMap((memory) => [
      ...memory.sourceEntryIds,
      ...memory.sourceDocumentIds,
    ]),
  );
  const dates = evidence.flatMap((memory) => sourceDatesForMemory(memory));
  return (
    sourceKeys.size >= 2 && dates.length >= 2 && Math.min(...dates) < Math.max(...dates)
  );
}

function overlapsSourceMoments(
  then: TemporalMirrorSection,
  now: TemporalMirrorSection,
  memoryMap: Map<string, MemoryEvidenceItem>,
): boolean {
  const thenSources = new Set(
    then.sourceMemoryIds.flatMap((id) => sourceKeys(memoryMap.get(id))),
  );
  return now.sourceMemoryIds
    .flatMap((id) => sourceKeys(memoryMap.get(id)))
    .some((source) => thenSources.has(source));
}

function sourceDates(
  memoryIds: string[],
  memoryMap: Map<string, MemoryEvidenceItem>,
): number[] {
  return memoryIds.flatMap((id) => {
    const memory = memoryMap.get(id);
    return memory ? sourceDatesForMemory(memory) : [];
  });
}

function sourceDatesForMemory(memory: MemoryEvidenceItem): number[] {
  if (!memory.sourceDate) {
    return [];
  }

  const timestamp = Date.parse(memory.sourceDate);
  return Number.isFinite(timestamp) ? [timestamp] : [];
}

function earliestDate(memory: MemoryEvidenceItem): number {
  return sourceDatesForMemory(memory)[0] ?? Number.MAX_SAFE_INTEGER;
}

function sourceKeys(memory: MemoryEvidenceItem | undefined): string[] {
  return memory ? [...memory.sourceEntryIds, ...memory.sourceDocumentIds] : [];
}

function boundedText(value: unknown, maximumLength: number): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }

  return value.trim().slice(0, maximumLength);
}

function extractJsonObject(value: string): string | null {
  const start = value.indexOf('{');
  const end = value.lastIndexOf('}');
  return start === -1 || end < start ? null : value.slice(start, end + 1);
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0,
      )
    : [];
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
