import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';

import type { OpeningQuestions, OpeningQuestionsBundle } from '../shared/reflection';

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
    return { questions: record.questions, generatedAt: record.generatedAt };
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
