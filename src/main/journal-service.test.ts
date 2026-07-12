import { describe, expect, it, vi } from 'vitest';

import type { EntryStorage } from './entry-storage';
import { createJournalService } from './journal-service';

describe('journal service', () => {
  it('returns a saved entry without waiting for Supermemory ingestion', async () => {
    const entry = {
      id: 'f408164b-4355-4da3-9c64-944d8f7129fb',
      createdAt: '2026-07-11T23:10:40.849Z',
      updatedAt: '2026-07-11T23:10:40.849Z',
      prompt: 'Prompt',
      content: 'Saved locally',
    };
    const storage = {
      createEntry: vi.fn().mockResolvedValue(entry),
    } as unknown as EntryStorage;
    const ingestEntry = vi.fn().mockReturnValue(new Promise(() => undefined));

    await expect(
      createJournalService(storage, { ingestEntry }).createEntry({
        prompt: entry.prompt,
        content: entry.content,
      }),
    ).resolves.toBe(entry);
    expect(ingestEntry).toHaveBeenCalledWith(entry);
  });

  it('logs a failed ingestion without turning the local save into a failure', async () => {
    const entry = {
      id: 'f408164b-4355-4da3-9c64-944d8f7129fb',
      createdAt: '2026-07-11T23:10:40.849Z',
      updatedAt: '2026-07-11T23:10:40.849Z',
      prompt: 'Prompt',
      content: 'Saved locally',
    };
    const storage = {
      createEntry: vi.fn().mockResolvedValue(entry),
    } as unknown as EntryStorage;
    const failure = new Error('offline');
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(
      createJournalService(storage, {
        ingestEntry: vi.fn().mockRejectedValue(failure),
      }).createEntry({ prompt: entry.prompt, content: entry.content }),
    ).resolves.toBe(entry);
    await Promise.resolve();

    expect(warning).toHaveBeenCalledWith(
      'Could not ingest journal entry into Supermemory Local.',
      failure,
    );
  });
});
