import { describe, expect, it, vi } from 'vitest';

import type { SupermemoryClient } from '../../src/main/supermemory-client';
import { JOURNAL_MEMORY_CONTAINER } from '../../src/main/supermemory-client';
import type {
  MemoryThreadCache,
  MemoryThreadCacheEntry,
} from '../../src/main/memory-thread-cache';

vi.mock('../../src/main/memory-insights', () => ({
  generateMemoryThreads: vi.fn(),
}));

import { generateMemoryThreads } from '../../src/main/memory-insights';
import { createMemoryService } from '../../src/main/memory-service';

const unavailableInsights = {
  status: 'unavailable' as const,
  threads: [],
  message:
    'Groq synthesis is not configured. Source memories are still available below.',
};

beforeEach(() => {
  vi.mocked(generateMemoryThreads).mockReset();
  vi.mocked(generateMemoryThreads).mockResolvedValue(unavailableInsights);
});

describe('memory service', () => {
  it('normalizes profile and paginated extracted memories', async () => {
    const post = vi
      .fn()
      .mockResolvedValueOnce({
        memoryEntries: [
          {
            id: 'one',
            memory: '  Building gives the week energy.  ',
            metadata: { sourceDate: '2026-07-10T15:30:00-07:00' },
          },
        ],
        pagination: { currentPage: 1, totalPages: 2 },
      })
      .mockResolvedValueOnce({
        memories: [{ id: 'two', memory: 'Rest has become easier to protect.' }],
        pagination: { currentPage: 2, totalPages: 2 },
      });
    const client = {
      profile: vi.fn().mockResolvedValue({
        profile: { static: ['Values quiet focus'], dynamic: ['Building often'] },
      }),
      post,
    } as unknown as SupermemoryClient;

    await expect(
      createMemoryService(Promise.resolve(client)).refresh(),
    ).resolves.toEqual({
      status: 'online',
      profile: {
        static: ['Values quiet focus'],
        dynamic: ['Building often'],
      },
      memories: [
        {
          id: 'one',
          text: 'Building gives the week energy.',
          sourceDate: '2026-07-10T15:30:00-07:00',
        },
        { id: 'two', text: 'Rest has become easier to protect.' },
      ],
      insights: {
        status: 'unavailable',
        message:
          'Groq synthesis is not configured. Source memories are still available below.',
      },
    });
    expect(post).toHaveBeenNthCalledWith(2, '/v4/memories/list', {
      body: {
        containerTags: [JOURNAL_MEMORY_CONTAINER],
        limit: 100,
        page: 2,
      },
    });
  });

  it('returns available memories when the profile request fails', async () => {
    const client = {
      profile: vi.fn().mockRejectedValue(new Error('profile unavailable')),
      post: vi.fn().mockResolvedValue({
        memories: [{ id: 'one', memory: 'A remembered pattern.' }],
      }),
    } as unknown as SupermemoryClient;

    await expect(
      createMemoryService(Promise.resolve(client)).refresh(),
    ).resolves.toEqual({
      status: 'online',
      profile: { static: [], dynamic: [] },
      memories: [{ id: 'one', text: 'A remembered pattern.' }],
      message: 'Some memory details could not be loaded. Try refreshing again.',
    });
  });

  it('normalizes direct memory metadata into source links', async () => {
    const entryId = 'f408164b-4355-4da3-9c64-944d8f7129fb';
    const client = {
      profile: vi.fn().mockResolvedValue({ profile: { static: [], dynamic: [] } }),
      post: vi.fn().mockResolvedValue({
        memoryEntries: [
          {
            id: 'memory-one',
            memory: 'The phone cutoff made evenings calmer.',
            metadata: {
              entryId,
              sourceDate: '2026-07-10T15:30:00-07:00',
            },
            documentIds: ['direct-memory-document'],
          },
        ],
      }),
    } as unknown as SupermemoryClient;

    await expect(
      createMemoryService(Promise.resolve(client)).refresh(),
    ).resolves.toMatchObject({
      memories: [
        {
          id: 'memory-one',
          sourceDate: '2026-07-10T15:30:00-07:00',
          sourceDocumentIds: ['direct-memory-document'],
          sourceEntryIds: [entryId],
        },
      ],
    });
  });

  it('normalizes complete request failure into an offline result', async () => {
    const client = {
      profile: vi.fn().mockRejectedValue(new Error('offline')),
      post: vi.fn().mockRejectedValue(new Error('offline')),
    } as unknown as SupermemoryClient;

    await expect(
      createMemoryService(Promise.resolve(client)).refresh(),
    ).resolves.toEqual({
      status: 'offline',
      profile: { static: [], dynamic: [] },
      memories: [],
      message: 'Supermemory Local is unavailable. Your journal remains saved locally.',
    });
  });

  it('normalizes client initialization failure into an offline result', async () => {
    await expect(
      createMemoryService(Promise.reject(new Error('unavailable'))).refresh(),
    ).resolves.toEqual({
      status: 'offline',
      profile: { static: [], dynamic: [] },
      memories: [],
      message: 'Supermemory Local is unavailable. Your journal remains saved locally.',
    });
  });

  it('ignores local-only saves and reuses cached threads without new Supermemory evidence', async () => {
    const thread = {
      id: 'attention-and-rest',
      title: 'Attention and rest',
      summary: 'A boundary is helping protect rest.',
      kind: 'progress' as const,
      sourceMemoryIds: ['memory-one'],
      sourceEntryIds: ['entry-one'],
      nextQuestion: 'What helps the boundary feel chosen?',
    };
    vi.mocked(generateMemoryThreads).mockResolvedValue({
      status: 'available',
      threads: [thread],
    });
    const cache = createFakeThreadCache();
    const client = createStableClient();
    const service = createMemoryService(Promise.resolve(client), undefined, {
      threadCache: cache,
    });

    const first = await service.refresh();
    const second = await service.refresh();

    expect(first.threads).toEqual([thread]);
    expect(second.threads).toEqual([thread]);
    expect(generateMemoryThreads).toHaveBeenCalledOnce();
    expect(cache.save).toHaveBeenCalledOnce();
  });

  it('does not regenerate when Supermemory returns the same evidence in a new order', async () => {
    vi.mocked(generateMemoryThreads).mockResolvedValue({
      status: 'available',
      threads: [],
    });
    const post = vi
      .fn()
      .mockResolvedValueOnce({
        memories: [
          { id: 'memory-one', memory: 'First memory.' },
          { id: 'memory-two', memory: 'Second memory.' },
        ],
      })
      .mockResolvedValueOnce({
        memories: [
          { id: 'memory-two', memory: 'Second memory.' },
          { id: 'memory-one', memory: 'First memory.' },
        ],
      });
    const client = {
      profile: vi.fn().mockResolvedValue({ profile: { static: [], dynamic: [] } }),
      post,
    } as unknown as SupermemoryClient;
    const service = createMemoryService(Promise.resolve(client), undefined, {
      threadCache: createFakeThreadCache(),
    });

    await service.refresh();
    await service.refresh();

    expect(generateMemoryThreads).toHaveBeenCalledOnce();
  });

  it('regenerates when ingested Supermemory evidence changes', async () => {
    vi.mocked(generateMemoryThreads).mockResolvedValue({
      status: 'available',
      threads: [],
    });
    const post = vi
      .fn()
      .mockResolvedValueOnce({ memories: [{ id: 'memory-one', memory: 'Before.' }] })
      .mockResolvedValueOnce({ memories: [{ id: 'memory-one', memory: 'After.' }] });
    const client = {
      profile: vi.fn().mockResolvedValue({ profile: { static: [], dynamic: [] } }),
      post,
    } as unknown as SupermemoryClient;
    const service = createMemoryService(Promise.resolve(client), undefined, {
      threadCache: createFakeThreadCache(),
    });

    await service.refresh();
    await service.refresh();

    expect(generateMemoryThreads).toHaveBeenCalledTimes(2);
  });

  it('regenerates when ingested memories are added or removed', async () => {
    vi.mocked(generateMemoryThreads).mockResolvedValue({
      status: 'available',
      threads: [],
    });
    const post = vi
      .fn()
      .mockResolvedValueOnce({ memories: [{ id: 'memory-one', memory: 'First.' }] })
      .mockResolvedValueOnce({
        memories: [
          { id: 'memory-one', memory: 'First.' },
          { id: 'memory-two', memory: 'Second.' },
        ],
      })
      .mockResolvedValueOnce({ memories: [{ id: 'memory-one', memory: 'First.' }] });
    const client = {
      profile: vi.fn().mockResolvedValue({ profile: { static: [], dynamic: [] } }),
      post,
    } as unknown as SupermemoryClient;
    const service = createMemoryService(Promise.resolve(client), undefined, {
      threadCache: createFakeThreadCache(),
    });

    await service.refresh();
    await service.refresh();
    await service.refresh();

    expect(generateMemoryThreads).toHaveBeenCalledTimes(3);
  });

  it('reuses a persisted cache after service recreation', async () => {
    vi.mocked(generateMemoryThreads).mockResolvedValue({
      status: 'available',
      threads: [],
    });
    const cache = createFakeThreadCache();
    const client = createStableClient();

    await createMemoryService(Promise.resolve(client), undefined, {
      threadCache: cache,
    }).refresh();
    vi.mocked(generateMemoryThreads).mockClear();
    await createMemoryService(Promise.resolve(client), undefined, {
      threadCache: cache,
    }).refresh();

    expect(generateMemoryThreads).not.toHaveBeenCalled();
  });

  it('does not replace a valid cache when Supermemory returns partial evidence', async () => {
    const thread = {
      id: 'attention-and-rest',
      title: 'Attention and rest',
      summary: 'A boundary is helping protect rest.',
      kind: 'progress' as const,
      sourceMemoryIds: ['memory-one'],
      sourceEntryIds: ['entry-one'],
    };
    vi.mocked(generateMemoryThreads).mockResolvedValue({
      status: 'available',
      threads: [thread],
    });
    const cache = createFakeThreadCache();
    const client = {
      profile: vi
        .fn()
        .mockResolvedValueOnce({ profile: { static: [], dynamic: [] } })
        .mockRejectedValueOnce(new Error('profile unavailable')),
      post: vi.fn().mockResolvedValue({
        memories: [{ id: 'memory-one', memory: 'A stable memory.' }],
      }),
    } as unknown as SupermemoryClient;
    const service = createMemoryService(Promise.resolve(client), undefined, {
      threadCache: cache,
    });

    await service.refresh();
    const partial = await service.refresh();

    expect(partial.threads).toBeUndefined();
    expect(cache.save).toHaveBeenCalledOnce();
    expect(generateMemoryThreads).toHaveBeenCalledOnce();
  });
});

function createStableClient(): SupermemoryClient {
  return {
    profile: vi.fn().mockResolvedValue({ profile: { static: [], dynamic: [] } }),
    post: vi.fn().mockResolvedValue({
      memories: [
        {
          id: 'memory-one',
          memory: 'The phone cutoff made mornings calmer.',
          metadata: { sourceDate: '2026-07-10T15:30:00.000Z', entryId: 'entry-one' },
        },
      ],
    }),
  } as unknown as SupermemoryClient;
}

function createFakeThreadCache(): MemoryThreadCache & {
  load: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
} {
  let value: MemoryThreadCacheEntry | null = null;
  return {
    load: vi
      .fn<() => Promise<MemoryThreadCacheEntry | null>>()
      .mockImplementation(() => Promise.resolve(value)),
    save: vi
      .fn<(next: MemoryThreadCacheEntry) => Promise<void>>()
      .mockImplementation((next) => {
        value = next;
        return Promise.resolve();
      }),
  };
}
