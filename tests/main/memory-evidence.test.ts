import { describe, expect, it, vi } from 'vitest';

import { retrieveMemoryEvidence } from '../../src/main/memory-evidence';
import type { SupermemoryClient } from '../../src/main/supermemory-client';

const sourceEntryId = 'f408164b-4355-4da3-9c64-944d8f7129fb';

describe('memory evidence retrieval', () => {
  it('normalizes strong search results and resolves included document metadata', async () => {
    const post = vi.fn().mockResolvedValue({ documents: [] });
    const client = {
      search: {
        memories: vi.fn().mockResolvedValue({
          results: [
            {
              id: 'memory-one',
              memory: 'Started a phone cutoff routine at 11pm.',
              similarity: 0.91,
              metadata: { sourceDate: '2026-07-10T15:30:00.000Z' },
              documents: [{ id: 'doc-one', customId: sourceEntryId }],
            },
          ],
        }),
      },
      post,
    } as unknown as SupermemoryClient;

    await expect(
      retrieveMemoryEvidence(client, ['phone cutoff routine'], {
        limit: 5,
        minimumSimilarity: 0.58,
      }),
    ).resolves.toEqual([
      {
        id: 'memory-one',
        text: 'Started a phone cutoff routine at 11pm.',
        similarity: 0.91,
        sourceDate: '2026-07-10T15:30:00.000Z',
        sourceDocumentIds: ['doc-one'],
        sourceEntryIds: [sourceEntryId],
      },
    ]);
  });

  it('resolves Supermemory document IDs through document customId lookup', async () => {
    const client = {
      search: {
        memories: vi.fn().mockResolvedValue({
          results: [
            {
              id: 'memory-one',
              memory: 'Small obligations have carried larger decisions.',
              similarity: 0.88,
              documents: [{ id: 'doc-one' }],
            },
          ],
        }),
      },
      post: vi.fn().mockResolvedValue({
        documents: [{ id: 'doc-one', customId: sourceEntryId }],
      }),
    } as unknown as SupermemoryClient;

    const evidence = await retrieveMemoryEvidence(client, ['unfinished obligations'], {
      limit: 4,
      minimumSimilarity: 0.58,
    });

    expect(evidence[0]?.sourceDocumentIds).toEqual(['doc-one']);
    expect(evidence[0]?.sourceEntryIds).toEqual([sourceEntryId]);
  });

  it('keeps unresolved document IDs without inventing local entry links', async () => {
    const client = {
      search: {
        memories: vi.fn().mockResolvedValue({
          results: [
            {
              id: 'memory-one',
              memory: 'Small obligations have carried larger decisions.',
              similarity: 0.88,
              documents: [{ id: 'doc-one' }],
            },
          ],
        }),
      },
      post: vi.fn().mockRejectedValue(new Error('documents unavailable')),
    } as unknown as SupermemoryClient;

    await expect(
      retrieveMemoryEvidence(client, ['unfinished obligations'], {
        limit: 4,
        minimumSimilarity: 0.58,
      }),
    ).resolves.toEqual([
      {
        id: 'memory-one',
        text: 'Small obligations have carried larger decisions.',
        similarity: 0.88,
        sourceDocumentIds: ['doc-one'],
        sourceEntryIds: [],
      },
    ]);
  });

  it('filters weak or malformed matches', async () => {
    const client = {
      search: {
        memories: vi.fn().mockResolvedValue({
          results: [
            { id: 'weak-memory', memory: 'Bought stamps.', similarity: 0.31 },
            { id: 'missing-text', similarity: 0.93 },
          ],
        }),
      },
      post: vi.fn(),
    } as unknown as SupermemoryClient;

    await expect(
      retrieveMemoryEvidence(client, ['larger decisions'], {
        limit: 4,
        minimumSimilarity: 0.58,
      }),
    ).resolves.toEqual([]);
    expect(client.post).not.toHaveBeenCalled();
  });
});
