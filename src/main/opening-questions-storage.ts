import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';

import type {
  MemoryEvidenceItem,
  OpeningQuestions,
  OpeningQuestionsBundle,
} from '../shared/reflection';

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
      return parseBundle(parsed);
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

function parseBundle(value: unknown): OpeningQuestionsBundle | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (isOpeningQuestions(record.questions) && typeof record.generatedAt === 'string') {
    const sourceMemories = parseSourceMemories(record.sourceMemories);
    return {
      questions: record.questions,
      generatedAt: record.generatedAt,
      ...(sourceMemories.length === 0 ? {} : { sourceMemories }),
    };
  }

  if (
    typeof record.primaryQuestion === 'string' &&
    typeof record.alternateQuestion === 'string' &&
    typeof record.generatedAt === 'string'
  ) {
    return {
      questions: [record.primaryQuestion, record.alternateQuestion],
      generatedAt: record.generatedAt,
    };
  }

  return null;
}

function isOpeningQuestions(value: unknown): value is OpeningQuestions {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every(
      (question) => typeof question === 'string' && question.trim().length > 0,
    )
  );
}

function parseSourceMemories(value: unknown): MemoryEvidenceItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const memories: MemoryEvidenceItem[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== 'object') {
      continue;
    }

    const record = candidate as Record<string, unknown>;
    const id = typeof record.id === 'string' ? record.id.trim() : '';
    const text = typeof record.text === 'string' ? record.text.trim() : '';
    const similarity =
      typeof record.similarity === 'number' && Number.isFinite(record.similarity)
        ? record.similarity
        : NaN;
    if (!id || !text || !Number.isFinite(similarity)) {
      continue;
    }

    const sourceDocumentIds = stringArray(record.sourceDocumentIds);
    const sourceEntryIds = stringArray(record.sourceEntryIds);
    const sourceDate =
      typeof record.sourceDate === 'string' && record.sourceDate.trim()
        ? record.sourceDate.trim()
        : undefined;

    memories.push({
      id,
      text,
      similarity,
      ...(sourceDate === undefined ? {} : { sourceDate }),
      sourceDocumentIds,
      sourceEntryIds,
    });
  }

  return memories;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? [
        ...new Set(
          value
            .filter((item): item is string => typeof item === 'string')
            .map((item) => item.trim())
            .filter(Boolean),
        ),
      ]
    : [];
}
