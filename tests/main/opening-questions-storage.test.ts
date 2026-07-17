import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createOpeningQuestionsStorage } from '../../src/main/opening-questions-storage';
import type {
  MemoryEvidenceItem,
  OpeningQuestionsBundle,
} from '../../src/shared/reflection';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true })),
  );
});

const sampleBundle: OpeningQuestionsBundle = {
  questions: [
    'What changed when you kept the phone cutoff last night?',
    'What are you learning about protecting your mornings?',
  ],
  generatedAt: new Date().toISOString(),
};
const sampleSourceMemory: MemoryEvidenceItem = {
  id: 'memory-one',
  text: 'Started a phone cutoff routine at 11pm.',
  similarity: 0.91,
  sourceDocumentIds: ['document-one'],
  sourceEntryIds: ['f408164b-4355-4da3-9c64-944d8f7129fb'],
};

describe('opening questions storage', () => {
  it('returns null when no bundle has been generated yet', async () => {
    const storage = createOpeningQuestionsStorage(await createTemporaryBundlePath());

    expect(await storage.get()).toBeNull();
  });

  it('persists and reads back a generated bundle', async () => {
    const storage = createOpeningQuestionsStorage(await createTemporaryBundlePath());

    await storage.set(sampleBundle);

    expect(await storage.get()).toEqual(sampleBundle);
  });

  it('persists source memories with generated questions', async () => {
    const storage = createOpeningQuestionsStorage(await createTemporaryBundlePath());
    const bundle = { ...sampleBundle, sourceMemories: [sampleSourceMemory] };

    await storage.set(bundle);

    expect(await storage.get()).toEqual(bundle);
  });

  it('clears the persisted bundle', async () => {
    const storage = createOpeningQuestionsStorage(await createTemporaryBundlePath());
    await storage.set(sampleBundle);

    await storage.clear();

    expect(await storage.get()).toBeNull();
  });

  it('does not throw when clearing a bundle that was never set', async () => {
    const storage = createOpeningQuestionsStorage(await createTemporaryBundlePath());

    await expect(storage.clear()).resolves.toBeUndefined();
  });

  it('falls back to null for malformed JSON', async () => {
    const bundlePath = await createTemporaryBundlePath();
    await writeFile(bundlePath, '{not json', 'utf8');
    const storage = createOpeningQuestionsStorage(bundlePath);

    expect(await storage.get()).toBeNull();
  });

  it('rejects stale legacy cached questions', async () => {
    const bundlePath = await createTemporaryBundlePath();
    await writeFile(
      bundlePath,
      JSON.stringify({
        primaryQuestion: 'What changed when you kept the phone cutoff last night?',
        alternateQuestion: 'What are you learning about protecting your mornings?',
        reason: 'legacy metadata',
        sourceMemoryIds: ['memory-one'],
        generatedAt: '2026-07-11T00:00:00.000Z',
      }),
      'utf8',
    );
    const storage = createOpeningQuestionsStorage(bundlePath);

    expect(await storage.get()).toBeNull();
  });

  it('rejects a generated bundle older than the active session window', async () => {
    const bundlePath = await createTemporaryBundlePath();
    await writeFile(
      bundlePath,
      JSON.stringify({ ...sampleBundle, generatedAt: '2020-01-01T00:00:00.000Z' }),
      'utf8',
    );
    const storage = createOpeningQuestionsStorage(bundlePath);

    expect(await storage.get()).toBeNull();
  });
});

async function createTemporaryBundlePath(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'afterthought-opening-questions-'));
  temporaryDirectories.push(directory);
  return join(directory, 'opening-questions.json');
}
