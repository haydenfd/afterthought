import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';

import type { MemoryIngestionRecord } from '../shared/memory';

export interface MemoryIngestionStorage {
  list(): Promise<Record<string, MemoryIngestionRecord>>;
  set(entryId: string, record: MemoryIngestionRecord): Promise<void>;
}

export function createMemoryIngestionStorage(
  filePath?: string,
): MemoryIngestionStorage {
  let records: Record<string, MemoryIngestionRecord> | null = null;

  async function list(): Promise<Record<string, MemoryIngestionRecord>> {
    if (records) {
      return { ...records };
    }

    records = await readRecords(filePath);
    return { ...records };
  }

  async function set(entryId: string, record: MemoryIngestionRecord): Promise<void> {
    const current = await list();
    current[entryId] = record;
    records = current;

    if (!filePath) {
      return;
    }

    await mkdir(dirname(filePath), { recursive: true });
    const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
    await rename(temporaryPath, filePath);
  }

  return { list, set };
}

async function readRecords(
  filePath: string | undefined,
): Promise<Record<string, MemoryIngestionRecord>> {
  if (!filePath) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(await readFile(filePath, 'utf8'));
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    const records: Record<string, MemoryIngestionRecord> = {};
    for (const [entryId, value] of Object.entries(parsed)) {
      const record = parseRecord(value);
      if (record) {
        records[entryId] = record;
      }
    }

    return records;
  } catch {
    return {};
  }
}

function parseRecord(value: unknown): MemoryIngestionRecord | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const state = record.state;
  if (
    state !== 'pending' &&
    state !== 'processing' &&
    state !== 'complete' &&
    state !== 'failed'
  ) {
    return null;
  }

  const updatedAt = typeof record.updatedAt === 'string' ? record.updatedAt : '';
  if (!updatedAt) {
    return null;
  }

  const attempts =
    typeof record.attempts === 'number' && Number.isFinite(record.attempts)
      ? Math.max(0, Math.floor(record.attempts))
      : 0;
  const remoteDocumentId = stringValue(record.remoteDocumentId);
  const remoteStatus = parseDocumentStatus(record.remoteStatus);
  const error = stringValue(record.error);

  return {
    state,
    updatedAt,
    attempts,
    ...(remoteDocumentId ? { remoteDocumentId } : {}),
    ...(remoteStatus ? { remoteStatus } : {}),
    ...(error ? { error } : {}),
  };
}

function parseDocumentStatus(value: unknown): MemoryIngestionRecord['remoteStatus'] {
  return value === 'unknown' ||
    value === 'queued' ||
    value === 'extracting' ||
    value === 'chunking' ||
    value === 'embedding' ||
    value === 'indexing' ||
    value === 'done' ||
    value === 'failed'
    ? value
    : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
