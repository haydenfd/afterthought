import { Supermemory } from 'supermemory';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';

import type { Preferences } from '../shared/preferences';
import { SUPERMEMORY_LOCAL_URL } from '../shared/supermemory';

export const JOURNAL_MEMORY_CONTAINER = 'afterthought:user:local';

export interface SupermemorySearchResult {
  id: string;
  memory?: string;
  text?: string;
  content?: string;
  similarity: number;
  metadata?: unknown;
  documents?: Array<{
    id?: string;
    customId?: string | null;
    metadata?: unknown;
    createdAt?: string;
    updatedAt?: string;
  }>;
}

export interface SupermemorySearchResponse {
  results: SupermemorySearchResult[];
}

export interface SupermemoryDocumentResult {
  id: string;
  status: string;
  customId?: string | null;
  metadata?: unknown;
  updatedAt?: string;
}

export interface SupermemoryDocumentListResponse {
  memories?: SupermemoryDocumentResult[];
  documents?: SupermemoryDocumentResult[];
  results?: SupermemoryDocumentResult[];
}

export interface SupermemoryClient {
  documents: {
    add: (input: {
      content: string;
      containerTag: string;
      customId: string;
      metadata: Record<string, string>;
      entityContext?: string;
    }) => Promise<unknown>;
    get?: (id: string) => Promise<SupermemoryDocumentResult>;
    update?: (
      id: string,
      input: {
        content: string;
        containerTag: string;
        customId: string;
        metadata: Record<string, string>;
        entityContext?: string;
      },
    ) => Promise<unknown>;
    list?: (input: {
      containerTags: string[];
      limit: number;
      page: number;
    }) => Promise<SupermemoryDocumentListResponse>;
  };
  profile: (input: { containerTag: string }) => Promise<unknown>;
  search: {
    memories: (input: {
      q: string;
      containerTag: string;
      limit?: number;
      rerank?: boolean;
      include?: { documents?: boolean };
    }) => Promise<SupermemorySearchResponse>;
  };
  post: <T>(path: string, options: { body: Record<string, unknown> }) => Promise<T>;
}

// Installing the local server binary on first run can take a while over the
// network, so give it more headroom than the SDK's 30s default.
const SUPERMEMORY_STARTUP_TIMEOUT_MS = 45_000;
const SUPERMEMORY_REACHABILITY_TIMEOUT_MS = 1_000;
const SUPERMEMORY_POLL_INTERVAL_MS = 250;

export async function createSupermemoryClient(
  baseURL: string = SUPERMEMORY_LOCAL_URL,
): Promise<SupermemoryClient> {
  await ensureSupermemoryLocalServer(baseURL);

  return Supermemory.local({
    start: false,
    baseURL,
    timeout: 5_000,
    maxRetries: 0,
  });
}

export function resolveSupermemoryUrl(preferences: Preferences): string {
  const configuredUrl = preferences.supermemoryUrl?.trim();
  return configuredUrl || SUPERMEMORY_LOCAL_URL;
}

async function ensureSupermemoryLocalServer(baseURL: string): Promise<void> {
  if (await isLocalServerReachable(baseURL)) {
    return;
  }

  await startSupermemoryLocalServer(getPort(baseURL));

  const deadline = Date.now() + SUPERMEMORY_STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await isLocalServerReachable(baseURL)) {
      return;
    }

    await sleep(SUPERMEMORY_POLL_INTERVAL_MS);
  }

  throw new Error(
    `Timed out waiting for local Supermemory server at ${baseURL}. Try running \`npx supermemory local\` manually.`,
  );
}

async function isLocalServerReachable(baseURL: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    SUPERMEMORY_REACHABILITY_TIMEOUT_MS,
  );

  try {
    await fetch(baseURL, {
      method: 'GET',
      signal: controller.signal,
    });

    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function startSupermemoryLocalServer(port: number | undefined): Promise<void> {
  const cliPath = getSupermemoryCliPath();
  const args = [cliPath, 'local'];

  if (port !== undefined) {
    args.push('--port', String(port));
  }

  const child = spawn(process.execPath, args, {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
    },
  });

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const settle = (callback: () => void) => {
      if (settled) {
        return;
      }

      settled = true;
      callback();
    };

    child.once('error', (error) => settle(() => reject(error)));
    setTimeout(() => settle(resolve), 100);
  });

  child.unref();
}

function getSupermemoryCliPath(): string {
  const cliPath = join(dirname(require.resolve('supermemory')), 'bin', 'cli');

  return cliPath.replace('app.asar', 'app.asar.unpacked');
}

function getPort(baseURL: string): number | undefined {
  try {
    const { port } = new URL(baseURL);
    if (!port) {
      return undefined;
    }

    return Number(port);
  } catch {
    return undefined;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
