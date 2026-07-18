import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createMemoryThreadCache } from '../../src/main/memory-thread-cache';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true })),
  );
});

describe('memory thread cache', () => {
  it('persists and reloads a valid thread result', async () => {
    const cachePath = await createTemporaryCachePath();
    const cache = createMemoryThreadCache(cachePath);
    const entry = {
      version: 1 as const,
      fingerprint: 'fingerprint-one',
      threads: [],
    };

    await cache.save(entry);

    await expect(cache.load()).resolves.toEqual(entry);
    expect(await readFile(cachePath, 'utf8')).toContain('fingerprint-one');
  });

  it('treats missing and corrupt cache files as empty', async () => {
    const cachePath = await createTemporaryCachePath();
    const cache = createMemoryThreadCache(cachePath);

    await expect(cache.load()).resolves.toBeNull();
    await writeFile(cachePath, '{not json', 'utf8');
    await expect(cache.load()).resolves.toBeNull();
  });
});

async function createTemporaryCachePath(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'afterthought-memory-cache-'));
  temporaryDirectories.push(directory);
  return join(directory, 'memory-threads.json');
}
