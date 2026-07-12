import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { CreateJournalEntryInput, JournalEntry } from '../shared/journal-entry';

export interface EntryStorage {
  createEntry(input: CreateJournalEntryInput): Promise<JournalEntry>;
  getEntry(id: string): Promise<JournalEntry | null>;
  listEntries(): Promise<JournalEntry[]>;
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createEntryStorage(entriesDirectory: string): EntryStorage {
  async function ensureEntriesDirectory(): Promise<void> {
    await mkdir(entriesDirectory, { recursive: true });
  }

  async function getEntry(id: string): Promise<JournalEntry | null> {
    if (!uuidPattern.test(id)) {
      return null;
    }

    try {
      const rawEntry = await readFile(join(entriesDirectory, `${id}.json`), 'utf8');
      const entry = parseEntry(rawEntry);

      if (!entry) {
        console.warn(`Skipping malformed journal entry: ${id}.json`);
      }

      return entry;
    } catch (error) {
      if (isMissingFileError(error)) {
        return null;
      }

      console.warn(`Could not read journal entry: ${id}.json`, error);
      return null;
    }
  }

  async function createEntry(input: CreateJournalEntryInput): Promise<JournalEntry> {
    const content = validateContent(input.content);
    const prompt = typeof input.prompt === 'string' ? input.prompt : '';
    const title = validateTitle(input.title);
    const timestamp = new Date().toISOString();
    const entry: JournalEntry = {
      id: randomUUID(),
      createdAt: timestamp,
      updatedAt: timestamp,
      prompt,
      content,
      ...(title === undefined ? {} : { title }),
    };

    await ensureEntriesDirectory();

    const entryPath = join(entriesDirectory, `${entry.id}.json`);
    const temporaryPath = join(entriesDirectory, `.${entry.id}.${randomUUID()}.tmp`);
    await writeFile(temporaryPath, `${JSON.stringify(entry, null, 2)}\n`, 'utf8');
    await rename(temporaryPath, entryPath);

    return entry;
  }

  async function listEntries(): Promise<JournalEntry[]> {
    await ensureEntriesDirectory();
    const fileNames = await readdir(entriesDirectory);
    const entries = await Promise.all(
      fileNames.map(async (fileName) => {
        if (!fileName.endsWith('.json')) {
          return null;
        }

        try {
          const rawEntry = await readFile(join(entriesDirectory, fileName), 'utf8');
          const entry = parseEntry(rawEntry);

          if (!entry) {
            console.warn(`Skipping malformed journal entry: ${fileName}`);
          }

          return entry;
        } catch (error) {
          console.warn(`Could not read journal entry: ${fileName}`, error);
          return null;
        }
      }),
    );

    return entries
      .filter((entry): entry is JournalEntry => entry !== null)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  return { createEntry, getEntry, listEntries };
}

function validateContent(content: unknown): string {
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new Error('Journal entry content cannot be empty.');
  }

  return content.trim();
}

function validateTitle(title: unknown): string | undefined {
  if (title === undefined) {
    return undefined;
  }

  if (typeof title !== 'string') {
    throw new Error('Journal entry title must be a string.');
  }

  return title;
}

function parseEntry(value: string): JournalEntry | null {
  try {
    const parsed: unknown = JSON.parse(value);

    if (!isJournalEntry(parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function isJournalEntry(value: unknown): value is JournalEntry {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === 'string' &&
    uuidPattern.test(entry.id) &&
    isIsoTimestamp(entry.createdAt) &&
    isIsoTimestamp(entry.updatedAt) &&
    typeof entry.prompt === 'string' &&
    typeof entry.content === 'string' &&
    entry.content.trim().length > 0 &&
    (entry.title === undefined || typeof entry.title === 'string')
  );
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(new Date(value).getTime());
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}
