import { Supermemory } from 'supermemory';

export const SUPERMEMORY_LOCAL_URL = 'http://localhost:6767';
export const JOURNAL_MEMORY_CONTAINER = 'afterthought:user:local';

export interface SupermemoryClient {
  documents: {
    add(input: {
      content: string;
      containerTag: string;
      customId: string;
      metadata: Record<string, string>;
    }): Promise<unknown>;
  };
  profile(input: { containerTag: string }): Promise<unknown>;
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
