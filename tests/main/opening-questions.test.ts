import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { EntryStorage } from '../../src/main/entry-storage';
import type { PreferencesStorage } from '../../src/main/preferences-storage';
import type { SupermemoryClient } from '../../src/main/supermemory-client';
import type { JournalEntry } from '../../src/shared/journal-entry';

vi.mock('../../src/main/groq-client', () => ({
  callGroq: vi.fn(),
}));

import { callGroq } from '../../src/main/groq-client';
import { generateOpeningQuestions } from '../../src/main/opening-questions';

beforeEach(() => {
  vi.mocked(callGroq).mockReset();
});

const recentEntry: JournalEntry = {
  id: 'b97b04cb-0f3e-4c9f-a062-fc290a1739b7',
  createdAt: '2026-07-10T14:05:00.000Z',
  updatedAt: '2026-07-10T14:05:00.000Z',
  prompt: "What's on your mind today?",
  content: 'Kept up the phone cutoff again last night.',
};
const sourceEntryId = 'f408164b-4355-4da3-9c64-944d8f7129fb';

function entryStorageStub(entries: JournalEntry[] = [recentEntry]): EntryStorage {
  return {
    createEntry: vi.fn(),
    getEntry: vi.fn(),
    listEntries: vi.fn().mockResolvedValue(entries),
  };
}

function preferencesStub(userName?: string): PreferencesStorage {
  return {
    getPreferences: vi.fn().mockResolvedValue({ userName }),
    setPreferences: vi.fn(),
  };
}

function clientWithMemory(): SupermemoryClient {
  return {
    profile: vi.fn().mockResolvedValue({
      profile: { static: [], dynamic: ['Has been experimenting with a phone cutoff.'] },
    }),
    search: {
      memories: vi.fn().mockResolvedValue({
        results: [
          {
            id: 'memory-one',
            memory: 'Started a phone cutoff routine at 11pm.',
            similarity: 0.9,
            documents: [{ id: 'source-document-one', customId: sourceEntryId }],
          },
        ],
      }),
    },
    post: vi.fn().mockResolvedValue({ documents: [] }),
    documents: { add: vi.fn() },
  };
}

const validGroqResponse = JSON.stringify([
  'What changed when you kept the phone cutoff last night?',
  'What are you learning about protecting your mornings?',
]);

describe('generateOpeningQuestions', () => {
  it('returns null without calling Groq when there are no journal entries yet', async () => {
    const client = clientWithMemory();

    await expect(
      generateOpeningQuestions(
        entryStorageStub([]),
        Promise.resolve(client),
        preferencesStub(),
      ),
    ).resolves.toBeNull();
    expect(callGroq).not.toHaveBeenCalled();
  });

  it('returns a validated bundle from a well-formed Groq response', async () => {
    vi.mocked(callGroq).mockResolvedValue(validGroqResponse);

    const result = await generateOpeningQuestions(
      entryStorageStub(),
      Promise.resolve(clientWithMemory()),
      preferencesStub('Hayden'),
    );

    expect(result).toMatchObject({
      questions: [
        'What changed when you kept the phone cutoff last night?',
        'What are you learning about protecting your mornings?',
      ],
      sourceMemories: [
        {
          id: 'memory-one',
          text: 'Started a phone cutoff routine at 11pm.',
          similarity: 0.9,
          sourceDocumentIds: ['source-document-one'],
          sourceEntryIds: [sourceEntryId],
        },
      ],
    });
    expect(typeof result?.generatedAt).toBe('string');
  });

  it('uses recent entries as primary context and asks for a two-question array', async () => {
    vi.mocked(callGroq).mockResolvedValue(validGroqResponse);

    await generateOpeningQuestions(
      entryStorageStub(),
      Promise.resolve(clientWithMemory()),
      preferencesStub(),
    );

    expect(callGroq).toHaveBeenCalledWith(expect.any(Array));
    const [messages] = vi.mocked(callGroq).mock.calls[0]!;
    const userMessage = messages.find((message) => message.role === 'user')?.content;
    const systemMessage = messages.find(
      (message) => message.role === 'system',
    )?.content;
    expect(userMessage).toContain('Kept up the phone cutoff again last night.');
    expect(systemMessage).toContain('JSON array of exactly two strings');
  });

  it('includes an authored historical follow-up response in the next-session context', async () => {
    vi.mocked(callGroq).mockResolvedValue(validGroqResponse);
    const entryWithFollowUp: JournalEntry = {
      ...recentEntry,
      deeperReflection: {
        question: 'What changed underneath the routine?',
        response: 'The routine helped because mornings felt less rushed.',
      },
    };

    await generateOpeningQuestions(
      entryStorageStub([entryWithFollowUp]),
      Promise.resolve(clientWithMemory()),
      preferencesStub(),
    );

    const [messages] = vi.mocked(callGroq).mock.calls[0]!;
    const userMessage = messages.find((message) => message.role === 'user')?.content;
    expect(userMessage).toContain(
      'Follow-up response: The routine helped because mornings felt less rushed.',
    );
  });

  it('asks for reflective observations instead of yes-or-no experiment check-ins', async () => {
    vi.mocked(callGroq).mockResolvedValue(validGroqResponse);

    await generateOpeningQuestions(
      entryStorageStub(),
      Promise.resolve(clientWithMemory()),
      preferencesStub(),
    );

    const [messages] = vi.mocked(callGroq).mock.calls[0]!;
    const systemMessage = messages.find(
      (message) => message.role === 'system',
    )?.content;
    expect(systemMessage).toContain(
      'Ask what changed, surprised them, or became noticeable',
    );
    expect(systemMessage).toContain('Avoid yes/no phrasing, advice, diagnosis');
  });

  it('returns null when Groq response is not valid JSON', async () => {
    vi.mocked(callGroq).mockResolvedValue('not json at all');

    await expect(
      generateOpeningQuestions(
        entryStorageStub(),
        Promise.resolve(clientWithMemory()),
        preferencesStub(),
      ),
    ).resolves.toBeNull();
  });

  it('returns null when Groq returns the wrong shape', async () => {
    vi.mocked(callGroq).mockResolvedValue(JSON.stringify(['Only one question?']));

    await expect(
      generateOpeningQuestions(
        entryStorageStub(),
        Promise.resolve(clientWithMemory()),
        preferencesStub(),
      ),
    ).resolves.toBeNull();
  });

  it('returns null when Groq itself fails', async () => {
    vi.mocked(callGroq).mockResolvedValue(null);

    await expect(
      generateOpeningQuestions(
        entryStorageStub(),
        Promise.resolve(clientWithMemory()),
        preferencesStub(),
      ),
    ).resolves.toBeNull();
  });

  it('still generates from entries alone when the Supermemory client is unavailable', async () => {
    vi.mocked(callGroq).mockResolvedValue(validGroqResponse);

    const result = await generateOpeningQuestions(
      entryStorageStub(),
      Promise.reject(new Error('offline')),
      preferencesStub(),
    );

    expect(result).toMatchObject({
      questions: [
        'What changed when you kept the phone cutoff last night?',
        'What are you learning about protecting your mornings?',
      ],
    });
    const [messages] = vi.mocked(callGroq).mock.calls[0]!;
    const userMessage = messages.find((message) => message.role === 'user')?.content;
    expect(userMessage).toContain('Kept up the phone cutoff again last night.');
    expect(userMessage).not.toContain('synthesized profile');
  });
});
