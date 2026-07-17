import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SupermemoryClient } from '../../src/main/supermemory-client';

vi.mock('../../src/main/groq-client', () => ({
  callGroq: vi.fn(),
  isGroqConfigured: vi.fn().mockReturnValue(true),
}));

import { callGroq } from '../../src/main/groq-client';
import { generateTemporalMirror } from '../../src/main/temporal-mirror';

const oldEntryId = '11111111-1111-4111-8111-111111111111';
const newEntryId = '22222222-2222-4222-8222-222222222222';

beforeEach(() => {
  vi.mocked(callGroq).mockReset();
});

describe('temporal mirror synthesis', () => {
  it('compares dated source moments and keeps source citations', async () => {
    vi.mocked(callGroq).mockResolvedValue(
      JSON.stringify({
        then: {
          summary: 'Earlier, uncertainty made the decision feel impossible to name.',
          sourceMemoryIds: ['memory-old'],
        },
        now: {
          summary:
            'More recently, the decision feels clearer even though it is not settled.',
          sourceMemoryIds: ['memory-new'],
        },
        shifted:
          'The question seems less about finding certainty and more about choosing a direction.',
        unresolved: 'The cost of choosing still feels real.',
      }),
    );

    const result = await generateTemporalMirror(
      Promise.resolve(clientStub()),
      'What has changed in how I relate to uncertainty?',
    );

    expect(result).toEqual({
      status: 'available',
      query: 'What has changed in how I relate to uncertainty?',
      then: {
        summary: 'Earlier, uncertainty made the decision feel impossible to name.',
        sourceMemoryIds: ['memory-old'],
        sourceEntryIds: [oldEntryId],
      },
      now: {
        summary:
          'More recently, the decision feels clearer even though it is not settled.',
        sourceMemoryIds: ['memory-new'],
        sourceEntryIds: [newEntryId],
      },
      shifted:
        'The question seems less about finding certainty and more about choosing a direction.',
      unresolved: 'The cost of choosing still feels real.',
      sourceMemories: [
        {
          id: 'memory-old',
          text: 'I keep circling the decision because uncertainty feels unsafe.',
          similarity: 0.92,
          sourceDate: '2026-06-01T12:00:00.000Z',
          sourceDocumentIds: [],
          sourceEntryIds: [oldEntryId],
        },
        {
          id: 'memory-new',
          text: 'I can see what I value now, even if I am not ready to decide.',
          similarity: 0.88,
          sourceDate: '2026-07-12T12:00:00.000Z',
          sourceDocumentIds: [],
          sourceEntryIds: [newEntryId],
        },
      ],
    });

    const userMessage = vi
      .mocked(callGroq)
      .mock.calls[0]?.[0].find((message) => message.role === 'user')?.content;
    expect(userMessage).toContain('What has changed in how I relate to uncertainty?');
    expect(userMessage).toContain('2026-06-01T12:00:00.000Z');
    expect(userMessage).toContain('2026-07-12T12:00:00.000Z');
  });

  it('does not produce a mirror from unsupported citations', async () => {
    vi.mocked(callGroq).mockResolvedValue(
      JSON.stringify({
        then: { summary: 'Earlier.', sourceMemoryIds: ['missing'] },
        now: { summary: 'Now.', sourceMemoryIds: ['memory-new'] },
        shifted: 'A change.',
        unresolved: 'Something remains open.',
      }),
    );

    await expect(
      generateTemporalMirror(Promise.resolve(clientStub()), 'What has changed?'),
    ).resolves.toMatchObject({
      status: 'insufficient',
      message:
        'The available source moments did not support a grounded Then and Now comparison yet.',
    });
  });

  it('asks for more evidence when source moments do not have temporal separation', async () => {
    const client = clientStub('2026-07-12T12:00:00.000Z');

    await expect(
      generateTemporalMirror(Promise.resolve(client), 'What has changed?'),
    ).resolves.toMatchObject({
      status: 'insufficient',
      message:
        'There are not yet two dated source moments about this. Write another entry or try a broader question.',
    });
    expect(callGroq).not.toHaveBeenCalled();
  });
});

function clientStub(sharedDate?: string): SupermemoryClient {
  return {
    profile: vi.fn(),
    search: {
      memories: vi.fn().mockResolvedValue({
        results: [
          {
            id: 'memory-old',
            memory: 'I keep circling the decision because uncertainty feels unsafe.',
            similarity: 0.92,
            documents: [
              {
                customId: oldEntryId,
                metadata: { sourceDate: sharedDate ?? '2026-06-01T12:00:00.000Z' },
              },
            ],
          },
          {
            id: 'memory-new',
            memory: 'I can see what I value now, even if I am not ready to decide.',
            similarity: 0.88,
            documents: [
              {
                customId: newEntryId,
                metadata: { sourceDate: sharedDate ?? '2026-07-12T12:00:00.000Z' },
              },
            ],
          },
        ],
      }),
    },
    post: vi.fn(),
    documents: { add: vi.fn() },
  };
}
