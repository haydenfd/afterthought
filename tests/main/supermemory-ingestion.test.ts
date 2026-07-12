import { describe, expect, it, vi } from 'vitest';

import type { JournalEntry } from '../../src/shared/journal-entry';
import type { PreferencesStorage } from '../../src/main/preferences-storage';
import type { SupermemoryClient } from '../../src/main/supermemory-client';
import { JOURNAL_MEMORY_CONTAINER } from '../../src/main/supermemory-client';
import { createJournalMemoryIngestor } from '../../src/main/supermemory-ingestion';

const entry: JournalEntry = {
  id: 'f408164b-4355-4da3-9c64-944d8f7129fb',
  createdAt: '2026-07-11T23:10:40.849Z',
  updatedAt: '2026-07-11T23:10:40.849Z',
  prompt: 'What stayed with you?',
  content: 'A quiet moment.',
};

function preferencesStub(userName?: string): PreferencesStorage {
  return {
    getPreferences: vi.fn().mockResolvedValue({ userName }),
    setPreferences: vi.fn(),
  };
}

describe('Supermemory journal ingestion', () => {
  it('sends the canonical completed entry to the local journal container', async () => {
    const add = vi.fn().mockResolvedValue({ id: 'document-id' });

    await createJournalMemoryIngestor(
      Promise.resolve({ documents: { add } } as unknown as SupermemoryClient),
      preferencesStub(),
    ).ingestEntry(entry);

    expect(add).toHaveBeenCalledWith({
      content:
        'Completed reflection — 2026-07-11\nApp-generated opening prompt: What stayed with you?\n\nUser-authored initial reflection:\nA quiet moment.',
      containerTag: JOURNAL_MEMORY_CONTAINER,
      customId: entry.id,
      metadata: {
        source: 'afterthought-journal',
        sourceDate: entry.createdAt,
      },
    });
  });

  it('sends clean prose, not a JSON blob with ids and timestamps', async () => {
    const add = vi.fn().mockResolvedValue({ id: 'document-id' });

    await createJournalMemoryIngestor(
      Promise.resolve({ documents: { add } } as unknown as SupermemoryClient),
      preferencesStub(),
    ).ingestEntry(entry);

    const { content } = add.mock.calls[0]![0] as { content: string };
    expect(content).not.toContain(entry.id);
    expect(content).not.toContain('createdAt');
    expect(content).toContain('A quiet moment.');
  });

  it('includes entityContext with the saved name when one is set', async () => {
    const add = vi.fn().mockResolvedValue({ id: 'document-id' });

    await createJournalMemoryIngestor(
      Promise.resolve({ documents: { add } } as unknown as SupermemoryClient),
      preferencesStub('Hayden'),
    ).ingestEntry(entry);

    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({
        entityContext: "The user's name is Hayden.",
      }),
    );
  });

  it('ingests a complete guided session as prose with theme metadata', async () => {
    const add = vi.fn().mockResolvedValue({ id: 'document-id' });
    const guidedEntry: JournalEntry = {
      ...entry,
      openingQuestions: [
        'What changed in the routine you were testing?',
        'What are you learning about protecting your attention?',
      ],
      deeperReflection: {
        question: 'What tends to pull your attention away first?',
        response: 'Uncertainty makes small interruptions feel easier to choose.',
        provenance: {
          strategy: 'connect-behavior-and-effect',
          sourceMemoryIds: ['memory-one'],
        },
      },
      themes: ['attention', 'uncertainty'],
    };

    await createJournalMemoryIngestor(
      Promise.resolve({ documents: { add } } as unknown as SupermemoryClient),
      preferencesStub(),
    ).ingestEntry(guidedEntry);

    const request = add.mock.calls[0]![0] as {
      content: string;
      metadata: Record<string, string>;
    };
    expect(request.content).toContain(
      'User-authored deeper reflection:\nUncertainty makes small interruptions feel easier to choose.',
    );
    expect(request.metadata.themes).toBe('attention, uncertainty');
    expect(request.content).toContain(
      'What are you learning about protecting your attention?',
    );
    expect(request.content).not.toContain('memory-one');
    expect(request.content).not.toContain('connect-behavior-and-effect');
  });

  it('marks an unanswered deeper prompt as app-generated rather than user-authored', async () => {
    const add = vi.fn().mockResolvedValue({ id: 'document-id' });

    await createJournalMemoryIngestor(
      Promise.resolve({ documents: { add } } as unknown as SupermemoryClient),
      preferencesStub(),
    ).ingestEntry({
      ...entry,
      deeperReflection: {
        question: 'What might finishing this decision make real?',
      },
    });

    const { content } = add.mock.calls[0]![0] as { content: string };
    expect(content).toContain(
      'App-generated deeper prompt (unanswered):\nWhat might finishing this decision make real?',
    );
    expect(content).not.toContain('User-authored deeper reflection:');
  });
});
