import type { CreateJournalEntryInput, JournalEntry } from '../shared/journal-entry';
import type { EntryStorage } from './entry-storage';
import type { JournalMemoryIngestor } from './supermemory-ingestion';

export interface JournalService {
  createEntry(input: CreateJournalEntryInput): Promise<JournalEntry>;
}

export function createJournalService(
  storage: EntryStorage,
  memory: JournalMemoryIngestor,
): JournalService {
  return {
    async createEntry(input) {
      const entry = await storage.createEntry(input);

      void memory.ingestEntry(entry).catch((error: unknown) => {
        console.warn('Could not ingest journal entry into Supermemory Local.', error);
      });

      return entry;
    },
  };
}
