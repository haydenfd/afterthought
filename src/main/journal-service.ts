import type { CreateJournalEntryInput, JournalEntry } from '../shared/journal-entry';
import type { EntryStorage } from './entry-storage';
import type { JournalMemoryIngestor } from './supermemory-ingestion';
import { inferFallbackThemes, normalizeThemes } from './reflection-themes';

export interface JournalService {
  createEntry(input: CreateJournalEntryInput): Promise<JournalEntry>;
}

export function createJournalService(
  storage: EntryStorage,
  memory: JournalMemoryIngestor,
): JournalService {
  return {
    async createEntry(input) {
      const suppliedThemes = normalizeThemes(input.themes);
      const entry = await storage.createEntry({
        ...input,
        themes:
          suppliedThemes.length > 0
            ? suppliedThemes
            : inferFallbackThemes(
                [
                  input.prompt,
                  input.content,
                  input.deeperReflection?.question,
                  input.deeperReflection?.response,
                ]
                  .filter((value): value is string => typeof value === 'string')
                  .join('\n'),
              ),
      });

      void memory.ingestEntry(entry).catch((error: unknown) => {
        console.warn('Could not ingest journal entry into Supermemory Local.', error);
      });

      return entry;
    },
  };
}
