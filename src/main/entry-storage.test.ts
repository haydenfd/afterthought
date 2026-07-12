import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createEntryStorage } from './entry-storage';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true })),
  );
});

describe('entry storage', () => {
  it('creates an entry as a JSON file', async () => {
    const entriesDirectory = await createTemporaryEntriesDirectory();
    const storage = createEntryStorage(entriesDirectory);

    const entry = await storage.createEntry({
      prompt: 'What stayed with you?',
      content: 'A quiet moment on the walk home.',
    });

    const savedEntry = JSON.parse(
      await readFile(join(entriesDirectory, `${entry.id}.json`), 'utf8'),
    ) as Record<string, unknown>;

    expect(entry.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(savedEntry).toMatchObject({
      id: entry.id,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      prompt: 'What stayed with you?',
      content: 'A quiet moment on the walk home.',
    });
  });

  it('rejects empty content', async () => {
    const storage = createEntryStorage(await createTemporaryEntriesDirectory());

    await expect(
      storage.createEntry({ prompt: 'Prompt', content: '   ' }),
    ).rejects.toThrow('Journal entry content cannot be empty.');
  });

  it('lists entries newest first', async () => {
    const storage = createEntryStorage(await createTemporaryEntriesDirectory());
    const first = await storage.createEntry({
      prompt: 'First',
      content: 'First entry',
    });
    const second = await storage.createEntry({
      prompt: 'Second',
      content: 'Second entry',
    });

    const entries = await storage.listEntries();

    expect(entries.map((entry) => entry.id)).toEqual([second.id, first.id]);
  });

  it('skips malformed JSON files while listing entries', async () => {
    const entriesDirectory = await createTemporaryEntriesDirectory();
    const storage = createEntryStorage(entriesDirectory);
    const savedEntry = await storage.createEntry({
      prompt: 'Prompt',
      content: 'Saved entry',
    });
    await writeFile(join(entriesDirectory, 'broken.json'), '{not json', 'utf8');
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const entries = await storage.listEntries();

    expect(entries).toHaveLength(1);
    expect(entries[0]?.id).toBe(savedEntry.id);
    expect(warning).toHaveBeenCalledWith(
      'Skipping malformed journal entry: broken.json',
    );
  });
});

async function createTemporaryEntriesDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'afterthought-entry-storage-'));
  temporaryDirectories.push(directory);
  return join(directory, 'entries');
}
