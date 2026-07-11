import Supermemory from 'supermemory';
import { z } from 'zod';

export const DEFAULT_SUPERMEMORY_URL = 'http://localhost:6767';

export type SupermemoryConnectionStatus = 'checking' | 'connected' | 'offline';

export interface ConnectionCheckResult {
  status: Exclude<SupermemoryConnectionStatus, 'checking'>;
  url: string;
  checkedAt: Date;
  message?: string;
}

export interface JournalEntryMemoryInput {
  date: string;
  prompt: string;
  content: string;
  followUpQuestion?: string;
}

export interface JournalEntryMemoryResult {
  stored: false;
  reason: string;
}

export interface MemorySearchResult {
  id: string;
  text: string;
  source: 'placeholder';
}

export interface ProfileSnapshot {
  priorities: string[];
  themes: string[];
  source: 'placeholder';
}

type FetchLike = typeof fetch;
type SupermemorySdkClient = Awaited<ReturnType<typeof Supermemory.local>>;

const urlSchema = z.string().url();

const journalEntrySchema = z.object({
  date: z.string().min(1),
  prompt: z.string().min(1),
  content: z.string().min(1),
  followUpQuestion: z.string().optional(),
});

export class AfterthoughtSupermemoryClient {
  private readonly fetchFn: FetchLike;
  private readonly timeoutMs: number;
  private readonly sdkClients = new Map<string, Promise<SupermemorySdkClient>>();

  constructor(
    private readonly baseUrl: string = DEFAULT_SUPERMEMORY_URL,
    options: { fetchFn?: FetchLike; timeoutMs?: number } = {},
  ) {
    this.fetchFn = options.fetchFn ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 1500;
  }

  async checkConnection(): Promise<ConnectionCheckResult> {
    const parsedUrl = normalizeSupermemoryUrl(this.baseUrl);
    if (!parsedUrl) {
      return {
        status: 'offline',
        url: this.baseUrl,
        checkedAt: new Date(),
        message: 'Invalid local URL',
      };
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      void (await this.getSdkClient(parsedUrl));

      const response = await this.fetchFn(parsedUrl, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });

      return {
        status: response.status < 500 ? 'connected' : 'offline',
        url: parsedUrl,
        checkedAt: new Date(),
      };
    } catch {
      return {
        status: 'offline',
        url: parsedUrl,
        checkedAt: new Date(),
      };
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  addJournalEntry(entry: JournalEntryMemoryInput): Promise<JournalEntryMemoryResult> {
    journalEntrySchema.parse(entry);

    return Promise.resolve({
      stored: false,
      reason:
        'Placeholder only. Journal memory writes will be connected after local storage and product flows exist.',
    });
  }

  searchMemories(query: string): Promise<MemorySearchResult[]> {
    z.string().min(1).parse(query);
    return Promise.resolve([]);
  }

  getProfile(): Promise<ProfileSnapshot> {
    return Promise.resolve({
      priorities: [],
      themes: [],
      source: 'placeholder',
    });
  }

  private getSdkClient(baseUrl: string): Promise<SupermemorySdkClient> {
    const existingClient = this.sdkClients.get(baseUrl);
    if (existingClient) {
      return existingClient;
    }

    const client = Supermemory.local({
      baseURL: baseUrl,
      start: false,
      timeout: this.timeoutMs,
      maxRetries: 0,
      fetch: this.fetchFn,
    });
    this.sdkClients.set(baseUrl, client);
    return client;
  }
}

export function createAfterthoughtSupermemoryClient(
  baseUrl: string = DEFAULT_SUPERMEMORY_URL,
  options?: { fetchFn?: FetchLike; timeoutMs?: number },
): AfterthoughtSupermemoryClient {
  return new AfterthoughtSupermemoryClient(baseUrl, options);
}

function normalizeSupermemoryUrl(value: string): string | null {
  const trimmed = value.trim();
  const result = urlSchema.safeParse(trimmed);

  if (!result.success) {
    return null;
  }

  return trimmed.replace(/\/+$/, '');
}
