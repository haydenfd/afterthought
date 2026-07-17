import { randomUUID } from 'node:crypto';
import { dirname } from 'node:path';
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';

import type { GroqApiKeyStatus } from '../shared/preferences';

type StoredGroqApiKey = {
  version: 1;
  encryptedKey: string;
};

export type GroqKeyEncryption = {
  isAvailable: () => boolean;
  encryptString: (value: string) => Buffer;
  decryptString: (value: Buffer) => string;
};

export interface GroqApiKeyStorage {
  getApiKey(): Promise<string | null>;
  getStatus(): Promise<GroqApiKeyStatus>;
  setApiKey(apiKey: string): Promise<GroqApiKeyStatus>;
  clearApiKey(): Promise<GroqApiKeyStatus>;
}

const unavailableMessage =
  'Secure OS storage is unavailable. Afterthought will not save the key until it is available.';

export function createGroqApiKeyStorage(
  keyPath: string,
  encryption: GroqKeyEncryption,
): GroqApiKeyStorage {
  async function getApiKey(): Promise<string | null> {
    const stored = await readStoredKey();
    if (!stored || !encryption.isAvailable()) {
      return null;
    }

    try {
      const apiKey = encryption.decryptString(
        Buffer.from(stored.encryptedKey, 'base64'),
      );
      return apiKey.trim() || null;
    } catch {
      return null;
    }
  }

  async function getStatus(): Promise<GroqApiKeyStatus> {
    const secureStorageAvailable = encryption.isAvailable();
    const stored = await readStoredKey();

    if (!stored) {
      return {
        configured: false,
        secureStorageAvailable,
        ...(secureStorageAvailable ? {} : { message: unavailableMessage }),
      };
    }

    if (!secureStorageAvailable) {
      return {
        configured: false,
        secureStorageAvailable: false,
        message: unavailableMessage,
      };
    }

    try {
      const apiKey = encryption
        .decryptString(Buffer.from(stored.encryptedKey, 'base64'))
        .trim();

      if (!apiKey) {
        return {
          configured: false,
          secureStorageAvailable: true,
          message: 'The saved Groq key is empty. Paste a new key to continue.',
        };
      }

      return {
        configured: true,
        secureStorageAvailable: true,
        maskedKey: maskApiKey(apiKey),
      };
    } catch {
      return {
        configured: false,
        secureStorageAvailable: true,
        message:
          'The saved Groq key could not be unlocked. Paste it again to replace it.',
      };
    }
  }

  async function setApiKey(apiKey: string): Promise<GroqApiKeyStatus> {
    const normalizedApiKey = apiKey.trim();
    if (!normalizedApiKey) {
      throw new Error('Paste a Groq API key before saving.');
    }

    if (!encryption.isAvailable()) {
      throw new Error(unavailableMessage);
    }

    const encryptedKey = encryption.encryptString(normalizedApiKey).toString('base64');
    const stored: StoredGroqApiKey = { version: 1, encryptedKey };

    await mkdir(dirname(keyPath), { recursive: true });
    const temporaryPath = `${keyPath}.${randomUUID()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(stored)}\n`, 'utf8');
    await rename(temporaryPath, keyPath);

    return {
      configured: true,
      secureStorageAvailable: true,
      maskedKey: maskApiKey(normalizedApiKey),
    };
  }

  async function clearApiKey(): Promise<GroqApiKeyStatus> {
    try {
      await unlink(keyPath);
    } catch (error) {
      if (!isMissingFileError(error)) {
        throw error;
      }
    }

    const secureStorageAvailable = encryption.isAvailable();
    return {
      configured: false,
      secureStorageAvailable,
      ...(secureStorageAvailable ? {} : { message: unavailableMessage }),
    };
  }

  async function readStoredKey(): Promise<StoredGroqApiKey | null> {
    try {
      const raw = await readFile(keyPath, 'utf8');
      return parseStoredKey(raw);
    } catch (error) {
      if (!isMissingFileError(error)) {
        console.warn('Could not read the encrypted Groq API key.');
      }
      return null;
    }
  }

  return { getApiKey, getStatus, setApiKey, clearApiKey };
}

export function maskApiKey(apiKey: string): string {
  const suffix = apiKey.slice(-2);
  return `••••••••${suffix}`;
}

function parseStoredKey(value: string): StoredGroqApiKey | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      (parsed as Record<string, unknown>).version !== 1 ||
      typeof (parsed as Record<string, unknown>).encryptedKey !== 'string' ||
      !(parsed as Record<string, unknown>).encryptedKey
    ) {
      return null;
    }

    return parsed as StoredGroqApiKey;
  } catch {
    return null;
  }
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}
