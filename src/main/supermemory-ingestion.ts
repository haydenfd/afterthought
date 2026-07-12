import type { JournalEntry } from '../shared/journal-entry';
import { JOURNAL_MEMORY_CONTAINER, type SupermemoryClient } from './supermemory-client';

export interface JournalMemoryIngestor {
  ingestEntry(entry: JournalEntry): Promise<void>;
}

export function createJournalMemoryIngestor(
  clientPromise: Promise<SupermemoryClient>,
): JournalMemoryIngestor {
  return {
    async ingestEntry(entry) {
      const client = await clientPromise;
      await client.documents.add({
        content: JSON.stringify(entry, null, 2),
        containerTag: JOURNAL_MEMORY_CONTAINER,
        customId: entry.id,
        metadata: {
          source: 'afterthought-journal',
          sourceDate: entry.createdAt,
        },
      });
    },
  };
}
