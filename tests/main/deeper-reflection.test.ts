import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { EntryStorage } from '../../src/main/entry-storage';
import type { SupermemoryClient } from '../../src/main/supermemory-client';
import type { JournalEntry } from '../../src/shared/journal-entry';
import type { DeeperQuestionInput } from '../../src/shared/reflection';

vi.mock('../../src/main/groq-client', () => ({
  callGroq: vi.fn(),
}));

import { generateDeeperQuestion } from '../../src/main/deeper-reflection';
import { callGroq } from '../../src/main/groq-client';

const input: DeeperQuestionInput = {
  openingQuestions: [
    'What changed in the routine you were testing?',
    'What are you learning about protecting your attention?',
  ],
  initialResponse:
    'I keep postponing a small email because finishing it would make the larger decision real.',
};

const recentEntry: JournalEntry = {
  id: 'b97b04cb-0f3e-4c9f-a062-fc290a1739b7',
  createdAt: '2026-07-10T14:05:00.000Z',
  updatedAt: '2026-07-10T14:05:00.000Z',
  prompt: 'What keeps unfinished work present in your attention?',
  content:
    'Small obligations have been hard to close while the direction is uncertain.',
  themes: ['uncertainty', 'attention'],
};

function storageStub(entries: JournalEntry[] = [recentEntry]): EntryStorage {
  return {
    createEntry: vi.fn(),
    getEntry: vi.fn(),
    listEntries: vi.fn().mockResolvedValue(entries),
  };
}

function clientStub(similarity = 0.91): SupermemoryClient {
  return {
    profile: vi.fn().mockResolvedValue({
      profile: {
        static: ['Values thoughtful decisions.'],
        dynamic: ['Has been reconsidering a work direction.'],
      },
    }),
    search: {
      memories: vi.fn().mockResolvedValue({
        results: [
          {
            id: 'strong-memory',
            memory:
              'Earlier, an unfinished application made a larger choice feel real.',
            similarity,
            documents: [{ id: 'source-entry-one' }],
          },
          {
            id: 'weak-memory',
            memory: 'Bought stamps for a letter.',
            similarity: 0.31,
          },
        ],
      }),
    },
    post: vi.fn(),
    documents: { add: vi.fn() },
  };
}

const plan = JSON.stringify({
  focus: 'Postponing a small task that represents a larger decision.',
  signals: ['avoidance', 'uncertainty'],
  themes: ['decision-making', 'avoidance'],
  retrievalQueries: ['unfinished obligations tied to larger decisions'],
  candidateStrategies: ['examine-avoidance', 'connect-behavior-and-effect'],
});

beforeEach(() => {
  vi.mocked(callGroq).mockReset();
});

describe('generateDeeperQuestion', () => {
  it('plans targeted retrieval, filters weak matches, and keeps used provenance', async () => {
    const client = clientStub();
    vi.mocked(callGroq)
      .mockResolvedValueOnce(plan)
      .mockResolvedValueOnce(
        JSON.stringify({
          question:
            'Earlier you wrote about a choice becoming real; what makes this unfinished email carry similar weight?',
          strategy: 'connect-behavior-and-effect',
          sourceMemoryIds: ['strong-memory', 'weak-memory', 'invented-memory'],
        }),
      );

    const result = await generateDeeperQuestion(
      storageStub(),
      Promise.resolve(client),
      input,
    );

    expect(vi.mocked(client.search.memories).mock.calls[0]?.[0]).toEqual({
      q: 'unfinished obligations tied to larger decisions',
      containerTag: 'afterthought:user:local',
      limit: 4,
      rerank: true,
      include: { documents: true },
    });
    expect(result).toEqual({
      question:
        'Earlier you wrote about a choice becoming real; what makes this unfinished email carry similar weight?',
      themes: ['decision-making', 'avoidance'],
      source: 'ai',
      provenance: {
        strategy: 'connect-behavior-and-effect',
        sourceMemoryIds: ['strong-memory'],
      },
    });

    const secondCall = vi.mocked(callGroq).mock.calls[1];
    const questionContext = secondCall?.[0].find(
      (message) => message.role === 'user',
    )?.content;
    const systemPrompt = secondCall?.[0].find(
      (message) => message.role === 'system',
    )?.content;
    expect(questionContext).toContain('strong-memory');
    expect(questionContext).not.toContain('weak-memory');
    expect(questionContext).toContain('Recently asked questions to avoid repeating');
    expect(systemPrompt).toContain('A single memory');
    expect(systemPrompt).toContain('at least two distinct verified source entries');
  });

  it('stays with the current response when retrieved evidence is weak', async () => {
    const client = clientStub(0.42);
    vi.mocked(callGroq)
      .mockResolvedValueOnce(plan)
      .mockResolvedValueOnce(
        JSON.stringify({
          question:
            'What larger decision would finishing this email make harder to avoid?',
          strategy: 'examine-avoidance',
          sourceMemoryIds: [],
        }),
      );

    const result = await generateDeeperQuestion(
      storageStub(),
      Promise.resolve(client),
      input,
    );

    expect(result.source).toBe('ai');
    expect(result.provenance.sourceMemoryIds).toEqual([]);
    const questionContext = vi
      .mocked(callGroq)
      .mock.calls[1]?.[0].find((message) => message.role === 'user')?.content;
    expect(questionContext).toContain(
      'No historical memory evidence was strong enough to include.',
    );
  });

  it('uses a reflective task fallback when planning is unavailable', async () => {
    vi.mocked(callGroq).mockResolvedValue(null);
    const client = clientStub();

    const result = await generateDeeperQuestion(
      storageStub(),
      Promise.resolve(client),
      input,
    );

    expect(result).toMatchObject({
      question: 'What seems to keep this unfinished thing present in your attention?',
      source: 'fallback',
      provenance: {
        strategy: 'connect-behavior-and-effect',
        sourceMemoryIds: [],
      },
    });
    expect(vi.mocked(client.search.memories).mock.calls).toHaveLength(0);
  });

  it('rejects malformed or yes-or-no generated questions', async () => {
    vi.mocked(callGroq)
      .mockResolvedValueOnce(plan)
      .mockResolvedValueOnce(
        JSON.stringify({
          question: 'Did you finish the email?',
          strategy: 'examine-avoidance',
          sourceMemoryIds: [],
        }),
      );

    const result = await generateDeeperQuestion(
      storageStub(),
      Promise.resolve(clientStub()),
      input,
    );

    expect(result.source).toBe('fallback');
    expect(result.question).not.toBe('Did you finish the email?');
  });

  it('rejects recurrence claims backed by only one source entry', async () => {
    vi.mocked(callGroq)
      .mockResolvedValueOnce(plan)
      .mockResolvedValueOnce(
        JSON.stringify({
          question:
            'What pattern often makes unfinished obligations carry more weight?',
          strategy: 'connect-recurring-experiences',
          sourceMemoryIds: ['strong-memory'],
        }),
      );

    const result = await generateDeeperQuestion(
      storageStub(),
      Promise.resolve(clientStub()),
      input,
    );

    expect(result.source).toBe('fallback');
    expect(result.question).not.toContain('pattern');
  });
});
