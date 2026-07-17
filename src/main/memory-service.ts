import type {
  MemoryIngestionSummary,
  MemoryItem,
  MemoryProfile,
  MemoryRefreshResult,
} from '../shared/memory';
import { generateMemoryThreads } from './memory-insights';
import { JOURNAL_MEMORY_CONTAINER, type SupermemoryClient } from './supermemory-client';

const memoryPageSize = 100;

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

export function createMemoryService(
  clientPromise: Promise<SupermemoryClient>,
  ingestion?: IngestionStatusProvider,
): MemoryService {
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
        memories.length > 0
          ? await generateMemoryThreads(memories, profile)
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
  const sourceDocumentIds = documents
    .map((document) => asRecord(document)?.id)
    .filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
  const sourceEntryIds = documents.flatMap((document) => {
    const documentRecord = asRecord(document);
    const metadata = asRecord(documentRecord?.metadata);
    return [documentRecord?.customId, metadata?.entryId, metadata?.customId].filter(
      (value): value is string => typeof value === 'string' && value.trim().length > 0,
    );
  });

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
