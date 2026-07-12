import type { JournalEntry } from '../shared/journal-entry';
import type { PreferencesStorage } from './preferences-storage';
import { JOURNAL_MEMORY_CONTAINER, type SupermemoryClient } from './supermemory-client';

export interface JournalMemoryIngestor {
  ingestEntry(entry: JournalEntry): Promise<void>;
}

export function createJournalMemoryIngestor(
  clientPromise: Promise<SupermemoryClient>,
  preferences: PreferencesStorage,
): JournalMemoryIngestor {
  return {
    async ingestEntry(entry) {
      const [client, { userName }] = await Promise.all([
        clientPromise,
        preferences.getPreferences(),
      ]);

      await client.documents.add({
        content: formatEntryForMemory(entry),
        containerTag: JOURNAL_MEMORY_CONTAINER,
        customId: entry.id,
        metadata: {
          source: 'afterthought-journal',
          sourceDate: entry.createdAt,
        },
        ...(userName ? { entityContext: `The user's name is ${userName}.` } : {}),
      });
    },
  };
}

/**
 * Supermemory extracts atomic memories from raw text, so we send the entry as
 * clean prose — a dated journal entry — rather than a JSON blob full of ids and
 * timestamps for the model to wade past. The local JSON file stays canonical.
 */
function formatEntryForMemory(entry: JournalEntry): string {
  const date = entry.createdAt.slice(0, 10);
  const lines = [`Journal entry — ${date}`];

  if (entry.title) {
    lines.push(entry.title);
  }
  if (entry.prompt) {
    lines.push(`Reflecting on: ${entry.prompt}`);
  }

  lines.push('', entry.content);

  return lines.join('\n');
}
