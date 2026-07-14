import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createEntryStorage } from '../../src/main/entry-storage';
import type { MemoryEvidenceItem } from '../../src/shared/reflection';

const temporaryDirectories: string[] = [];
const sourceMemory: MemoryEvidenceItem = {
  id: 'memory-one',
  text: 'Earlier, uncertainty made every smaller choice feel urgent.',
  similarity: 0.89,
  sourceDate: '2026-07-10T14:05:00.000Z',
  sourceDocumentIds: ['document-one'],
  sourceEntryIds: ['f408164b-4355-4da3-9c64-944d8f7129fb'],
};

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

  it('persists a complete guided session with themes and provenance', async () => {
    const storage = createEntryStorage(await createTemporaryEntriesDirectory());

    const entry = await storage.createEntry({
      prompt: 'What changed in the routine?',
      openingQuestions: [
        'What changed in the routine?',
        'What are you learning about your attention?',
      ],
      content: 'The routine helped until uncertainty took over.',
      openingContext: [sourceMemory, sourceMemory],
      deeperReflection: {
        question: 'What makes uncertainty so interrupting?',
        response: 'It makes every smaller choice feel urgent.',
        provenance: {
          strategy: 'connect-behavior-and-effect',
          sourceMemoryIds: ['memory-one', 'memory-one'],
          sourceMemories: [sourceMemory],
        },
      },
      themes: [' Attention ', 'uncertainty', 'attention'],
    });

    expect(await storage.getEntry(entry.id)).toMatchObject({
      openingQuestions: [
        'What changed in the routine?',
        'What are you learning about your attention?',
      ],
      openingContext: [sourceMemory],
      deeperReflection: {
        question: 'What makes uncertainty so interrupting?',
        response: 'It makes every smaller choice feel urgent.',
        provenance: {
          strategy: 'connect-behavior-and-effect',
          sourceMemoryIds: ['memory-one'],
          sourceMemories: [sourceMemory],
        },
      },
      themes: ['attention', 'uncertainty'],
    });
  });

  it('continues to read entries saved before guided sessions were added', async () => {
    const entriesDirectory = await createTemporaryEntriesDirectory();
    const storage = createEntryStorage(entriesDirectory);
    await storage.listEntries();
    const legacyEntry = {
      id: 'f408164b-4355-4da3-9c64-944d8f7129fb',
      createdAt: '2026-07-11T23:10:40.849Z',
      updatedAt: '2026-07-11T23:10:40.849Z',
      prompt: 'What stayed with you?',
      content: 'A quiet moment.',
    };
    await writeFile(
      join(entriesDirectory, `${legacyEntry.id}.json`),
      JSON.stringify(legacyEntry),
      'utf8',
    );

    await expect(storage.getEntry(legacyEntry.id)).resolves.toEqual(legacyEntry);
  });

  it('lists entries newest first', async () => {
    const storage = createEntryStorage(await createTemporaryEntriesDirectory());
    vi.useFakeTimers();

    try {
      vi.setSystemTime(new Date('2026-07-12T01:00:00.000Z'));
      const first = await storage.createEntry({
        prompt: 'First',
        content: 'First entry',
      });
      vi.setSystemTime(new Date('2026-07-12T01:00:00.001Z'));
      const second = await storage.createEntry({
        prompt: 'Second',
        content: 'Second entry',
      });

      const entries = await storage.listEntries();

      expect(entries.map((entry) => entry.id)).toEqual([second.id, first.id]);
    } finally {
      vi.useRealTimers();
    }
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
