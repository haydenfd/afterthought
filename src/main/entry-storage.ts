import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type {
  CreateJournalEntryInput,
  DeeperReflection,
  JournalEntry,
} from '../shared/journal-entry';
import {
  reflectionStrategies,
  type OpeningQuestions,
  type ReflectionProvenance,
} from '../shared/reflection';
import { normalizeThemes } from './reflection-themes';

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
    const openingQuestions = validateOpeningQuestions(input.openingQuestions);
    const deeperReflection = validateDeeperReflection(input.deeperReflection);
    const themes = normalizeThemes(input.themes);
    const timestamp = new Date().toISOString();
    const entry: JournalEntry = {
      id: randomUUID(),
      createdAt: timestamp,
      updatedAt: timestamp,
      prompt,
      content,
      ...(title === undefined ? {} : { title }),
      ...(openingQuestions === undefined ? {} : { openingQuestions }),
      ...(deeperReflection === undefined ? {} : { deeperReflection }),
      ...(themes.length === 0 ? {} : { themes }),
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

function validateOpeningQuestions(value: unknown): OpeningQuestions | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value) || value.length !== 2) {
    throw new Error('Opening questions must contain exactly two questions.');
  }

  const questions: unknown[] = value;
  const first = questions[0];
  const second = questions[1];
  if (
    typeof first !== 'string' ||
    !first.trim() ||
    typeof second !== 'string' ||
    !second.trim()
  ) {
    throw new Error('Opening questions must contain exactly two questions.');
  }

  return [first.trim(), second.trim()];
}

function validateDeeperReflection(value: unknown): DeeperReflection | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!value || typeof value !== 'object') {
    throw new Error('Deeper reflection is invalid.');
  }

  const reflection = value as Record<string, unknown>;
  if (typeof reflection.question !== 'string' || !reflection.question.trim()) {
    throw new Error('Deeper reflection question cannot be empty.');
  }

  const response =
    typeof reflection.response === 'string' && reflection.response.trim()
      ? reflection.response.trim()
      : undefined;
  const provenance = validateProvenance(reflection.provenance);

  return {
    question: reflection.question.trim(),
    ...(response === undefined ? {} : { response }),
    ...(provenance === undefined ? {} : { provenance }),
  };
}

function validateProvenance(value: unknown): ReflectionProvenance | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (!value || typeof value !== 'object') {
    throw new Error('Reflection provenance is invalid.');
  }

  const provenance = value as Record<string, unknown>;
  const sourceMemoryIds: unknown[] = Array.isArray(provenance.sourceMemoryIds)
    ? provenance.sourceMemoryIds
    : [];
  if (
    typeof provenance.strategy !== 'string' ||
    !reflectionStrategies.includes(
      provenance.strategy as (typeof reflectionStrategies)[number],
    ) ||
    !Array.isArray(provenance.sourceMemoryIds) ||
    sourceMemoryIds.some((id) => typeof id !== 'string')
  ) {
    throw new Error('Reflection provenance is invalid.');
  }

  return {
    strategy: provenance.strategy as ReflectionProvenance['strategy'],
    sourceMemoryIds: [...new Set(sourceMemoryIds as string[])],
  };
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
    (entry.title === undefined || typeof entry.title === 'string') &&
    (entry.openingQuestions === undefined ||
      validateStoredOpeningQuestions(entry.openingQuestions)) &&
    (entry.deeperReflection === undefined ||
      validateStoredDeeperReflection(entry.deeperReflection)) &&
    (entry.themes === undefined ||
      (Array.isArray(entry.themes) &&
        entry.themes.every((theme) => typeof theme === 'string')))
  );
}

function validateStoredOpeningQuestions(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((question) => typeof question === 'string' && question.trim())
  );
}

function validateStoredDeeperReflection(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const reflection = value as Record<string, unknown>;
  return (
    typeof reflection.question === 'string' &&
    reflection.question.trim().length > 0 &&
    (reflection.response === undefined || typeof reflection.response === 'string') &&
    (reflection.provenance === undefined || isStoredProvenance(reflection.provenance))
  );
}

function isStoredProvenance(value: unknown): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const provenance = value as Record<string, unknown>;
  return (
    typeof provenance.strategy === 'string' &&
    reflectionStrategies.includes(
      provenance.strategy as (typeof reflectionStrategies)[number],
    ) &&
    Array.isArray(provenance.sourceMemoryIds) &&
    provenance.sourceMemoryIds.every((id) => typeof id === 'string')
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
