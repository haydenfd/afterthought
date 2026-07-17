import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createGroqApiKeyStorage,
  type GroqKeyEncryption,
} from '../../src/main/groq-key-storage';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true })),
  );
});

describe('Groq API key storage', () => {
  it('encrypts the key on disk and exposes only a masked suffix', async () => {
    const keyPath = await createTemporaryKeyPath();
    const encryption = fakeEncryption();
    const storage = createGroqApiKeyStorage(keyPath, encryption);

    await expect(storage.setApiKey('gsk_test-secret')).resolves.toEqual({
      configured: true,
      secureStorageAvailable: true,
      maskedKey: '••••••••et',
    });

    const stored = await readFile(keyPath, 'utf8');
    expect(stored).not.toContain('gsk_test-secret');
    await expect(storage.getApiKey()).resolves.toBe('gsk_test-secret');
    await expect(storage.getStatus()).resolves.toEqual({
      configured: true,
      secureStorageAvailable: true,
      maskedKey: '••••••••et',
    });
  });

  it('does not save a key when secure OS storage is unavailable', async () => {
    const keyPath = await createTemporaryKeyPath();
    const encryption = fakeEncryption(false);
    const storage = createGroqApiKeyStorage(keyPath, encryption);

    await expect(storage.setApiKey('gsk_test-secret')).rejects.toThrow(
      'Secure OS storage is unavailable',
    );
    await expect(storage.getStatus()).resolves.toMatchObject({
      configured: false,
      secureStorageAvailable: false,
    });
  });

  it('clears a previously saved key', async () => {
    const keyPath = await createTemporaryKeyPath();
    const storage = createGroqApiKeyStorage(keyPath, fakeEncryption());
    await storage.setApiKey('gsk_test-secret');

    await expect(storage.clearApiKey()).resolves.toEqual({
      configured: false,
      secureStorageAvailable: true,
    });
    await expect(storage.getApiKey()).resolves.toBeNull();
  });
});

function fakeEncryption(isAvailable = true): GroqKeyEncryption {
  return {
    isAvailable: vi.fn(() => isAvailable),
    encryptString: (value) => Buffer.from(`encrypted:${value}`, 'utf8'),
    decryptString: (value) => {
      const decoded = value.toString('utf8');
      if (!decoded.startsWith('encrypted:')) {
        throw new Error('Could not decrypt');
      }

      return decoded.slice('encrypted:'.length);
    },
  };
}

async function createTemporaryKeyPath(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'afterthought-groq-key-'));
  temporaryDirectories.push(directory);
  return join(directory, 'groq-api-key.json');
}
