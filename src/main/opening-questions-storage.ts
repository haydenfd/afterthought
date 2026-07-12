import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';

import type { OpeningQuestionsBundle } from '../shared/reflection';

export interface OpeningQuestionsStorage {
  get(): Promise<OpeningQuestionsBundle | null>;
  set(bundle: OpeningQuestionsBundle): Promise<void>;
  clear(): Promise<void>;
}

export function createOpeningQuestionsStorage(
  bundlePath: string,
): OpeningQuestionsStorage {
  async function get(): Promise<OpeningQuestionsBundle | null> {
    try {
      const raw = await readFile(bundlePath, 'utf8');
      const parsed: unknown = JSON.parse(raw);
      return isOpeningQuestionsBundle(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  async function set(bundle: OpeningQuestionsBundle): Promise<void> {
    await mkdir(dirname(bundlePath), { recursive: true });

    const temporaryPath = `${bundlePath}.${randomUUID()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(bundle, null, 2)}\n`, 'utf8');
    await rename(temporaryPath, bundlePath);
  }

  async function clear(): Promise<void> {
    try {
      await rm(bundlePath);
    } catch {
      // Nothing to clear.
    }
  }

  return { get, set, clear };
}

function isOpeningQuestionsBundle(value: unknown): value is OpeningQuestionsBundle {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.primaryQuestion === 'string' &&
    typeof record.alternateQuestion === 'string' &&
    typeof record.reason === 'string' &&
    Array.isArray(record.sourceMemoryIds) &&
    record.sourceMemoryIds.every((id) => typeof id === 'string') &&
    typeof record.generatedAt === 'string'
  );
}
