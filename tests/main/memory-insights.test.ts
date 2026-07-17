import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MemoryItem } from '../../src/shared/memory';

vi.mock('../../src/main/groq-client', () => ({
  callGroq: vi.fn(),
}));

import { callGroq } from '../../src/main/groq-client';
import { generateMemoryThreads } from '../../src/main/memory-insights';

const memories: MemoryItem[] = [
  {
    id: 'memory-one',
    text: 'The phone cutoff made mornings feel less rushed.',
    sourceDate: '2026-07-10T15:30:00.000Z',
    sourceEntryIds: ['entry-one'],
  },
  {
    id: 'memory-two',
    text: 'Uncertainty still pulled attention toward the phone at night.',
    sourceDate: '2026-07-12T15:30:00.000Z',
    sourceEntryIds: ['entry-two'],
  },
];

beforeEach(() => {
  vi.mocked(callGroq).mockReset();
});

describe('memory insight synthesis', () => {
  it('returns cited threads with a bounded next question', async () => {
    vi.mocked(callGroq).mockResolvedValue(
      JSON.stringify({
        threads: [
          {
            id: 'attention-and-rest',
            title: 'Attention and rest',
            summary:
              'A new boundary is helping, while uncertainty still makes it harder to let the day end.',
            kind: 'shifting',
            sourceMemoryIds: ['memory-one', 'memory-two'],
            nextQuestion:
              'What helps the boundary feel chosen when uncertainty returns?',
          },
        ],
      }),
    );

    await expect(
      generateMemoryThreads(memories, { static: [], dynamic: [] }),
    ).resolves.toEqual([
      {
        id: 'attention-and-rest',
        title: 'Attention and rest',
        summary:
          'A new boundary is helping, while uncertainty still makes it harder to let the day end.',
        kind: 'shifting',
        sourceMemoryIds: ['memory-one', 'memory-two'],
        sourceEntryIds: ['entry-one', 'entry-two'],
        nextQuestion: 'What helps the boundary feel chosen when uncertainty returns?',
      },
    ]);
  });

  it('drops threads that cite memories which were not retrieved', async () => {
    vi.mocked(callGroq).mockResolvedValue(
      JSON.stringify({
        threads: [
          {
            id: 'invented',
            title: 'Invented thread',
            summary: 'This is not supported by the evidence.',
            kind: 'present',
            sourceMemoryIds: ['missing-memory'],
          },
        ],
      }),
    );

    await expect(
      generateMemoryThreads(memories, { static: [], dynamic: [] }),
    ).resolves.toEqual([]);
  });

  it('returns no interpretation when Groq is unavailable', async () => {
    vi.mocked(callGroq).mockResolvedValue(null);

    await expect(
      generateMemoryThreads(memories, { static: [], dynamic: [] }),
    ).resolves.toEqual([]);
  });
});
