import { describe, expect, it, vi } from 'vitest';

import type { SupermemoryClient } from '../../src/main/supermemory-client';
import { JOURNAL_MEMORY_CONTAINER } from '../../src/main/supermemory-client';

vi.mock('../../src/main/memory-insights', () => ({
  generateMemoryThreads: vi.fn().mockResolvedValue({
    status: 'unavailable',
    threads: [],
    message:
      'Groq synthesis is not configured. Source memories are still available below.',
  }),
}));

import { createMemoryService } from '../../src/main/memory-service';

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
      insights: {
        status: 'unavailable',
        message:
          'Groq synthesis is not configured. Source memories are still available below.',
      },
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
});
