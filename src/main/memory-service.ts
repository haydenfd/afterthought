import type { MemoryItem, MemoryProfile, MemoryRefreshResult } from '../shared/memory';
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

export function createMemoryService(
  clientPromise: Promise<SupermemoryClient>,
): MemoryService {
  return {
    async refresh() {
      let client: SupermemoryClient;
      try {
        client = await clientPromise;
      } catch {
        return offlineResult();
      }

      const [profileResult, memoriesResult] = await Promise.allSettled([
        client.profile({ containerTag: JOURNAL_MEMORY_CONTAINER }),
        listAllMemories(client),
      ]);

      if (profileResult.status === 'rejected' && memoriesResult.status === 'rejected') {
        return offlineResult();
      }

      const partial =
        profileResult.status === 'rejected' || memoriesResult.status === 'rejected';

      return {
        status: 'online',
        profile:
          profileResult.status === 'fulfilled'
            ? normalizeProfile(profileResult.value)
            : emptyProfile(),
        memories:
          memoriesResult.status === 'fulfilled'
            ? memoriesResult.value.map(normalizeMemory).filter(isMemoryItem)
            : [],
        ...(partial
          ? {
              message: 'Some memory details could not be loaded. Try refreshing again.',
            }
          : {}),
      };
    },
  };
}

function offlineResult(): MemoryRefreshResult {
  return {
    status: 'offline',
    profile: emptyProfile(),
    memories: [],
    message: 'Supermemory Local is unavailable. Your journal remains saved locally.',
  };
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
  };
}

function isMemoryItem(value: MemoryItem | null): value is MemoryItem {
  return value !== null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}
