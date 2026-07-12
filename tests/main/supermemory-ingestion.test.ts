import { describe, expect, it, vi } from 'vitest';

import type { JournalEntry } from '../../src/shared/journal-entry';
import type { SupermemoryClient } from '../../src/main/supermemory-client';
import { JOURNAL_MEMORY_CONTAINER } from '../../src/main/supermemory-client';
import { createJournalMemoryIngestor } from '../../src/main/supermemory-ingestion';

describe('Supermemory journal ingestion', () => {
  it('sends the canonical completed entry to the local journal container', async () => {
    const add = vi.fn().mockResolvedValue({ id: 'document-id' });
    const entry: JournalEntry = {
      id: 'f408164b-4355-4da3-9c64-944d8f7129fb',
      createdAt: '2026-07-11T23:10:40.849Z',
      updatedAt: '2026-07-11T23:10:40.849Z',
      prompt: 'What stayed with you?',
      content: 'A quiet moment.',
    };

    await createJournalMemoryIngestor(
      Promise.resolve({ documents: { add } } as unknown as SupermemoryClient),
    ).ingestEntry(entry);

    expect(add).toHaveBeenCalledWith({
      content: JSON.stringify(entry, null, 2),
      containerTag: JOURNAL_MEMORY_CONTAINER,
      customId: entry.id,
      metadata: {
        source: 'afterthought-journal',
        sourceDate: entry.createdAt,
      },
    });
  });
});
