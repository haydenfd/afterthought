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

    const result = await storage.setPreferences({
      supermemoryUrl: 'http://localhost:6767',
    });

    expect(result).toEqual({ supermemoryUrl: 'http://localhost:6767' });
    expect(JSON.parse(await readFile(preferencesPath, 'utf8'))).toEqual({
      supermemoryUrl: 'http://localhost:6767',
    });
  });

  it('merges updates with previously saved preferences', async () => {
    const storage = createPreferencesStorage(await createTemporaryPreferencesPath());
    await storage.setPreferences({ appearance: 'light' });

    const result = await storage.setPreferences({ appearance: 'dark' });

    expect(result).toEqual({ appearance: 'dark' });
    expect(await storage.getPreferences()).toEqual({ appearance: 'dark' });
  });

  it('persists appearance and supermemoryUrl', async () => {
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

  it('persists the installation timestamp alongside other preferences', async () => {
    const storage = createPreferencesStorage(await createTemporaryPreferencesPath());
    const installedAt = '2026-07-14T12:00:00.000Z';

    const result = await storage.setPreferences({ installedAt });

    expect(result).toEqual({ installedAt });
    expect(await storage.getPreferences()).toEqual({ installedAt });
  });

  it('rejects a malformed appearance value and falls back to an empty object', async () => {
    const preferencesPath = await createTemporaryPreferencesPath();
    await writeFile(preferencesPath, JSON.stringify({ appearance: 'purple' }), 'utf8');
    const storage = createPreferencesStorage(preferencesPath);

    expect(await storage.getPreferences()).toEqual({});
  });

  it('migrates legacy appearance to dark and removes the old name field', async () => {
    const preferencesPath = await createTemporaryPreferencesPath();
    await writeFile(
      preferencesPath,
      JSON.stringify({ userName: 'Hayden', appearance: 'system' }),
      'utf8',
    );
    const storage = createPreferencesStorage(preferencesPath);

    expect(await storage.getPreferences()).toEqual({
      appearance: 'dark',
    });
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
