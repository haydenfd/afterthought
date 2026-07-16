import { Supermemory } from 'supermemory';

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

export interface SupermemoryClient {
  documents: {
    add: (input: {
      content: string;
      containerTag: string;
      customId: string;
      metadata: Record<string, string>;
      entityContext?: string;
    }) => Promise<unknown>;
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

export function createSupermemoryClient(
  baseURL: string = SUPERMEMORY_LOCAL_URL,
): Promise<SupermemoryClient> {
  // Supermemory.local() spawns its launcher via `process.execPath`, assuming a
  // plain Node binary. In Electron's main process that path points at the
  // Electron binary itself, which boots as a GUI app instead of running the
  // script unless the child inherits ELECTRON_RUN_AS_NODE. Set it for the
  // duration of this call so the spawned child runs as Node, then restore it.
  const previousRunAsNode = process.env.ELECTRON_RUN_AS_NODE;
  process.env.ELECTRON_RUN_AS_NODE = '1';

  return Supermemory.local({
    start: true,
    baseURL,
    startupTimeout: SUPERMEMORY_STARTUP_TIMEOUT_MS,
    timeout: 5_000,
    maxRetries: 0,
  }).finally(() => {
    if (previousRunAsNode === undefined) {
      delete process.env.ELECTRON_RUN_AS_NODE;
    } else {
      process.env.ELECTRON_RUN_AS_NODE = previousRunAsNode;
    }
  });
}

export function resolveSupermemoryUrl(preferences: Preferences): string {
  const configuredUrl = preferences.supermemoryUrl?.trim();
  return configuredUrl || SUPERMEMORY_LOCAL_URL;
}
