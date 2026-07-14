import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';

import type { Preferences } from '../shared/preferences';

export interface PreferencesStorage {
  getPreferences(): Promise<Preferences>;
  setPreferences(update: Partial<Preferences>): Promise<Preferences>;
}

export function createPreferencesStorage(preferencesPath: string): PreferencesStorage {
  async function getPreferences(): Promise<Preferences> {
    try {
      const raw = await readFile(preferencesPath, 'utf8');
      return parsePreferences(raw);
    } catch (error) {
      if (isMissingFileError(error)) {
        return {};
      }

      console.warn('Could not read preferences.', error);
      return {};
    }
  }

  async function setPreferences(update: Partial<Preferences>): Promise<Preferences> {
    const current = await getPreferences();
    const next: Preferences = { ...current, ...update };

    await mkdir(dirname(preferencesPath), { recursive: true });

    const temporaryPath = `${preferencesPath}.${randomUUID()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(next, null, 2)}\n`, 'utf8');
    await rename(temporaryPath, preferencesPath);

    return next;
  }

  return { getPreferences, setPreferences };
}

function parsePreferences(value: string): Preferences {
  try {
    const parsed: unknown = JSON.parse(value);
    return isPreferences(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

const appearanceValues = ['light', 'dark', 'system'];

function isPreferences(value: unknown): value is Preferences {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    (record.installedAt === undefined || typeof record.installedAt === 'string') &&
    (record.userName === undefined || typeof record.userName === 'string') &&
    (record.appearance === undefined ||
      appearanceValues.includes(record.appearance as string)) &&
    (record.supermemoryUrl === undefined || typeof record.supermemoryUrl === 'string')
  );
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}
