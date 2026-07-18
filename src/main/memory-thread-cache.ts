import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';

import type { MemoryThread, MemoryThreadKind } from '../shared/memory';

const cacheVersion = 1;
const memoryThreadKinds: MemoryThreadKind[] = [
  'present',
  'unresolved',
  'shifting',
  'steady',
  'progress',
];

export type MemoryThreadCacheEntry = {
  version: typeof cacheVersion;
  fingerprint: string;
  threads: MemoryThread[];
};

export interface MemoryThreadCache {
  load(): Promise<MemoryThreadCacheEntry | null>;
  save(entry: MemoryThreadCacheEntry): Promise<void>;
}

export function createMemoryThreadCache(cachePath: string): MemoryThreadCache {
  async function load(): Promise<MemoryThreadCacheEntry | null> {
    try {
      return parseCache(await readFile(cachePath, 'utf8'));
    } catch {
      return null;
    }
  }

  async function save(entry: MemoryThreadCacheEntry): Promise<void> {
    await mkdir(dirname(cachePath), { recursive: true });
    const temporaryPath = `${cachePath}.${randomUUID()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(entry, null, 2)}\n`, 'utf8');
    await rename(temporaryPath, cachePath);
  }

  return { load, save };
}

function parseCache(value: string): MemoryThreadCacheEntry | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed) || parsed.version !== cacheVersion) {
      return null;
    }

    if (
      typeof parsed.fingerprint !== 'string' ||
      !Array.isArray(parsed.threads) ||
      !parsed.threads.every(isMemoryThread)
    ) {
      return null;
    }

    return {
      version: cacheVersion,
      fingerprint: parsed.fingerprint,
      threads: parsed.threads,
    };
  } catch {
    return null;
  }
}

function isMemoryThread(value: unknown): value is MemoryThread {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.summary === 'string' &&
    typeof value.kind === 'string' &&
    memoryThreadKinds.includes(value.kind as MemoryThreadKind) &&
    Array.isArray(value.sourceMemoryIds) &&
    value.sourceMemoryIds.every((id) => typeof id === 'string') &&
    Array.isArray(value.sourceEntryIds) &&
    value.sourceEntryIds.every((id) => typeof id === 'string') &&
    (value.nextQuestion === undefined || typeof value.nextQuestion === 'string')
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
