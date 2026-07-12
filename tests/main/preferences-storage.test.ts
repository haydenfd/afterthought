import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createPreferencesStorage } from '../../src/main/preferences-storage';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true })),
  );
});

describe('preferences storage', () => {
  it('returns an empty object when no preferences file exists yet', async () => {
    const storage = createPreferencesStorage(await createTemporaryPreferencesPath());

    expect(await storage.getPreferences()).toEqual({});
  });

  it('persists a preferences update as a JSON file', async () => {
    const preferencesPath = await createTemporaryPreferencesPath();
    const storage = createPreferencesStorage(preferencesPath);

    const result = await storage.setPreferences({ userName: 'Hayden' });

    expect(result).toEqual({ userName: 'Hayden' });
    expect(JSON.parse(await readFile(preferencesPath, 'utf8'))).toEqual({
      userName: 'Hayden',
    });
  });

  it('merges updates with previously saved preferences', async () => {
    const storage = createPreferencesStorage(await createTemporaryPreferencesPath());
    await storage.setPreferences({ userName: 'Hayden' });

    const result = await storage.setPreferences({ userName: 'Alex' });

    expect(result).toEqual({ userName: 'Alex' });
    expect(await storage.getPreferences()).toEqual({ userName: 'Alex' });
  });

  it('persists appearance and supermemoryUrl alongside userName', async () => {
    const storage = createPreferencesStorage(await createTemporaryPreferencesPath());

    const result = await storage.setPreferences({
      appearance: 'dark',
      supermemoryUrl: 'http://localhost:7000',
    });

    expect(result).toEqual({
      appearance: 'dark',
      supermemoryUrl: 'http://localhost:7000',
    });
    expect(await storage.getPreferences()).toEqual({
      appearance: 'dark',
      supermemoryUrl: 'http://localhost:7000',
    });
  });

  it('rejects a malformed appearance value and falls back to an empty object', async () => {
    const preferencesPath = await createTemporaryPreferencesPath();
    await writeFile(preferencesPath, JSON.stringify({ appearance: 'purple' }), 'utf8');
    const storage = createPreferencesStorage(preferencesPath);

    expect(await storage.getPreferences()).toEqual({});
  });

  it('falls back to an empty object for malformed JSON', async () => {
    const preferencesPath = await createTemporaryPreferencesPath();
    await writeFile(preferencesPath, '{not json', 'utf8');
    const storage = createPreferencesStorage(preferencesPath);

    expect(await storage.getPreferences()).toEqual({});
  });
});

async function createTemporaryPreferencesPath(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'afterthought-preferences-'));
  temporaryDirectories.push(directory);
  return join(directory, 'preferences.json');
}
