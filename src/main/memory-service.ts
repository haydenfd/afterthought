import { createHash } from 'node:crypto';

import type {
  MemoryIngestionSummary,
  MemoryItem,
  MemoryProfile,
  MemoryRefreshResult,
} from '../shared/memory';
import { generateMemoryThreads, type MemoryInsightResult } from './memory-insights';
import type { MemoryThreadCache, MemoryThreadCacheEntry } from './memory-thread-cache';
import { JOURNAL_MEMORY_CONTAINER, type SupermemoryClient } from './supermemory-client';

const memoryPageSize = 100;
const memoryInsightFingerprintVersion = 'memory-insights-v1';

interface MemoryListPage {
  memories?: unknown[];
  memoryEntries?: unknown[];
  results?: unknown[];
  pagination?: {
    currentPage?: number;
    totalPages?: number;
    nextCursor?: string | null;
  };
  nextCursor?: string | null;
}

export interface MemoryService {
  refresh(): Promise<MemoryRefreshResult>;
}

type IngestionStatusProvider = {
  getStatus?: () => Promise<MemoryIngestionSummary>;
};

type MemoryServiceOptions = {
  threadCache?: MemoryThreadCache;
};

export function createMemoryService(
  clientPromise: Promise<SupermemoryClient>,
  ingestion?: IngestionStatusProvider,
  options: MemoryServiceOptions = {},
): MemoryService {
  const cacheLoadPromise = options.threadCache?.load().catch(() => null);
  let cachedThreads: MemoryThreadCacheEntry | null | undefined;
  const synthesisPromises = new Map<string, Promise<MemoryInsightResult>>();

  return {
    async refresh() {
      const ingestionStatus = await readIngestionStatus(ingestion);
      let client: SupermemoryClient;
      try {
        client = await clientPromise;
      } catch {
        return offlineResult(ingestionStatus);
      }

      const [profileResult, memoriesResult] = await Promise.allSettled([
        client.profile({ containerTag: JOURNAL_MEMORY_CONTAINER }),
        listAllMemories(client),
      ]);

      if (profileResult.status === 'rejected' && memoriesResult.status === 'rejected') {
        return offlineResult(ingestionStatus);
      }

      const partial =
        profileResult.status === 'rejected' || memoriesResult.status === 'rejected';

      const profile =
        profileResult.status === 'fulfilled'
          ? normalizeProfile(profileResult.value)
          : emptyProfile();
      const memories =
        memoriesResult.status === 'fulfilled'
          ? normalizeMemories(memoriesResult.value)
          : [];
      const insights =
        !partial && memories.length > 0
          ? await getMemoryInsights(memories, profile)
          : undefined;

      return {
        status: 'online',
        profile,
        memories,
        ...(insights
          ? {
              insights: {
                status: insights.status,
                ...(insights.message ? { message: insights.message } : {}),
              },
            }
          : {}),
        ...(insights?.threads.length ? { threads: insights.threads } : {}),
        ...(ingestionStatus ? { ingestion: ingestionStatus } : {}),
        ...(partial
          ? {
              message: 'Some memory details could not be loaded. Try refreshing again.',
            }
          : {}),
      };
    },
  };

  async function getMemoryInsights(
    memories: MemoryItem[],
    profile: MemoryProfile,
  ): Promise<MemoryInsightResult> {
    const fingerprint = createMemoryFingerprint(memories, profile);
    const cached = await loadCachedThreads();
    if (cached?.fingerprint === fingerprint) {
      return { status: 'available', threads: cached.threads };
    }

    const existingSynthesis = synthesisPromises.get(fingerprint);
    if (existingSynthesis) {
      return existingSynthesis;
    }

    const synthesis = generateMemoryThreads(memories, profile)
      .then(async (result) => {
        if (result.status === 'available') {
          const entry: MemoryThreadCacheEntry = {
            version: 1,
            fingerprint,
            threads: result.threads,
          };
          cachedThreads = entry;
          await options.threadCache?.save(entry).catch(() => undefined);
        }

        return result;
      })
      .finally(() => {
        synthesisPromises.delete(fingerprint);
      });

    synthesisPromises.set(fingerprint, synthesis);
    return synthesis;
  }

  async function loadCachedThreads(): Promise<MemoryThreadCacheEntry | null> {
    if (cachedThreads !== undefined) {
      return cachedThreads;
    }

    cachedThreads = (await cacheLoadPromise) ?? null;
    return cachedThreads;
  }
}

function createMemoryFingerprint(
  memories: MemoryItem[],
  profile: MemoryProfile,
): string {
  const canonicalMemories = memories
    .map((memory) => ({
      id: memory.id,
      text: memory.text,
      sourceDate: memory.sourceDate ?? null,
      sourceDocumentIds: [...(memory.sourceDocumentIds ?? [])].sort(),
      sourceEntryIds: [...(memory.sourceEntryIds ?? [])].sort(),
    }))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  const canonicalProfile = {
    static: [...profile.static].sort(),
    dynamic: [...profile.dynamic].sort(),
  };

  return createHash('sha256')
    .update(
      JSON.stringify({
        version: memoryInsightFingerprintVersion,
        memories: canonicalMemories,
        profile: canonicalProfile,
      }),
    )
    .digest('hex');
}

function offlineResult(ingestion?: MemoryIngestionSummary): MemoryRefreshResult {
  return {
    status: 'offline',
    profile: emptyProfile(),
    memories: [],
    ...(ingestion ? { ingestion } : {}),
    message: 'Supermemory Local is unavailable. Your journal remains saved locally.',
  };
}

async function readIngestionStatus(
  ingestion: IngestionStatusProvider | undefined,
): Promise<MemoryIngestionSummary | undefined> {
  if (!ingestion?.getStatus) {
    return undefined;
  }

  return ingestion.getStatus().catch(() => undefined);
}

async function listAllMemories(client: SupermemoryClient): Promise<unknown[]> {
  const memories: unknown[] = [];
  let page = 1;
  let cursor: string | undefined;

  for (;;) {
    const response = await client.post<MemoryListPage>('/v4/memories/list', {
      body: {
        containerTags: [JOURNAL_MEMORY_CONTAINER],
        limit: memoryPageSize,
        page,
        ...(cursor ? { cursor } : {}),
      },
    });
    const pageMemories = Array.isArray(response.memories)
      ? response.memories
      : Array.isArray(response.memoryEntries)
        ? response.memoryEntries
        : Array.isArray(response.results)
          ? response.results
          : [];
    memories.push(...pageMemories);

    const nextCursor = response.nextCursor ?? response.pagination?.nextCursor;
    const currentPage = response.pagination?.currentPage ?? page;
    const totalPages = response.pagination?.totalPages ?? currentPage;

    if (nextCursor) {
      cursor = nextCursor;
      page += 1;
      continue;
    }

    if (currentPage < totalPages) {
      page = currentPage + 1;
      continue;
    }

    return memories;
  }
}

function emptyProfile(): MemoryProfile {
  return { static: [], dynamic: [] };
}

function normalizeProfile(value: unknown): MemoryProfile {
  const record = asRecord(value);
  const profile = asRecord(record?.profile);

  return {
    static: stringArray(profile?.static),
    dynamic: stringArray(profile?.dynamic),
  };
}

function normalizeMemory(value: unknown): MemoryItem | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const text = [record.memory, record.text, record.content].find(
    (candidate): candidate is string =>
      typeof candidate === 'string' && candidate.trim().length > 0,
  );
  if (!text) {
    return null;
  }

  const metadata = asRecord(record.metadata);
  const sourceDate = metadata?.sourceDate;

  return {
    id: typeof record.id === 'string' ? record.id : text,
    text: text.trim(),
    ...(typeof sourceDate === 'string' ? { sourceDate } : {}),
    ...sourceIds(record),
  };
}

function sourceIds(record: Record<string, unknown>): {
  sourceDocumentIds?: string[];
  sourceEntryIds?: string[];
} {
  const documents = Array.isArray(record.documents) ? record.documents : [];
  const documentIds = Array.isArray(record.documentIds) ? record.documentIds : [];
  const metadata = asRecord(record.metadata);
  const sourceDocumentIds = documents
    .map((document) => asRecord(document)?.id)
    .filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
  sourceDocumentIds.push(
    ...documentIds.filter(
      (id): id is string => typeof id === 'string' && id.trim().length > 0,
    ),
  );
  const sourceEntryIds = documents.flatMap((document) => {
    const documentRecord = asRecord(document);
    const metadata = asRecord(documentRecord?.metadata);
    return [documentRecord?.customId, metadata?.entryId, metadata?.customId].filter(
      (value): value is string => typeof value === 'string' && value.trim().length > 0,
    );
  });
  sourceEntryIds.push(
    ...[metadata?.entryId, metadata?.sourceEntryId].filter(
      (id): id is string => typeof id === 'string' && id.trim().length > 0,
    ),
  );

  return {
    ...(sourceDocumentIds.length > 0
      ? { sourceDocumentIds: unique(sourceDocumentIds) }
      : {}),
    ...(sourceEntryIds.length > 0 ? { sourceEntryIds: unique(sourceEntryIds) } : {}),
  };
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function normalizeMemories(values: unknown[]): MemoryItem[] {
  const memories: MemoryItem[] = [];

  for (const value of values) {
    const memory = normalizeMemory(value);
    if (memory) {
      memories.push(memory);
    }
  }

  return memories;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}
