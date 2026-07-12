/// <reference types="vite/client" />

import type { CreateJournalEntryInput, JournalEntry } from '../shared/journal-entry';
import type { MemoryRefreshResult } from '../shared/memory';
import type { Preferences } from '../shared/preferences';

declare global {
  interface Window {
    afterthought: {
      platform: string;
      versions: {
        chrome: string | undefined;
        electron: string | undefined;
      };
      supermemory: {
        checkConnection: (url: string) => Promise<{
          status: 'connected' | 'offline';
          url: string;
          message?: string;
        }>;
      };
      entries: {
        create: (input: CreateJournalEntryInput) => Promise<JournalEntry>;
        get: (id: string) => Promise<JournalEntry | null>;
        list: () => Promise<JournalEntry[]>;
      };
      memory: {
        refresh: () => Promise<MemoryRefreshResult>;
      };
      preferences: {
        get: () => Promise<Preferences>;
        set: (update: Partial<Preferences>) => Promise<Preferences>;
      };
    };
  }
}
