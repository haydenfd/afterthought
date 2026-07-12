import { Supermemory } from 'supermemory';

export const SUPERMEMORY_LOCAL_URL = 'http://localhost:6767';
export const JOURNAL_MEMORY_CONTAINER = 'afterthought:user:local';

export interface SupermemorySearchResult {
  id: string;
  memory?: string;
  similarity: number;
}

export interface SupermemorySearchResponse {
  results: SupermemorySearchResult[];
}

export interface SupermemoryClient {
  documents: {
    add(input: {
      content: string;
      containerTag: string;
      customId: string;
      metadata: Record<string, string>;
      entityContext?: string;
    }): Promise<unknown>;
  };
  profile(input: { containerTag: string }): Promise<unknown>;
  search: {
    memories(input: {
      q: string;
      containerTag: string;
      limit?: number;
      rerank?: boolean;
    }): Promise<SupermemorySearchResponse>;
  };
  post<T>(path: string, options: { body: Record<string, unknown> }): Promise<T>;
}

export function createSupermemoryClient(): Promise<SupermemoryClient> {
  return Supermemory.local({
    start: false,
    baseURL: SUPERMEMORY_LOCAL_URL,
    timeout: 5_000,
    maxRetries: 0,
  });
}
