/// <reference types="vite/client" />

import type { CreateJournalEntryInput, JournalEntry } from '../shared/journal-entry';
import type { MemoryRefreshResult } from '../shared/memory';
import type { GroqApiKeyStatus, Preferences } from '../shared/preferences';
import type {
  DeeperQuestionInput,
  DeeperQuestionResult,
  OpeningQuestionsResult,
} from '../shared/reflection';
import type { SupermemoryConnectionResult } from '../shared/supermemory';

declare global {
  interface Window {
    afterthought: {
      platform: string;
      versions: {
        chrome: string | undefined;
        electron: string | undefined;
      };
      supermemory: {
        checkConnection: (url: string) => Promise<SupermemoryConnectionResult>;
      };
      entries: {
        create: (input: CreateJournalEntryInput) => Promise<JournalEntry>;
        get: (id: string) => Promise<JournalEntry | null>;
        list: () => Promise<JournalEntry[]>;
      };
      memory: {
        refresh: () => Promise<MemoryRefreshResult>;
        retryIngestion: () => Promise<MemoryRefreshResult['ingestion']>;
      };
      groq: {
        getStatus: () => Promise<GroqApiKeyStatus>;
        setApiKey: (apiKey: string) => Promise<GroqApiKeyStatus>;
        clearApiKey: () => Promise<GroqApiKeyStatus>;
      };
      preferences: {
        get: () => Promise<Preferences>;
        set: (update: Partial<Preferences>) => Promise<Preferences>;
      };
      reflection: {
        openingQuestions: () => Promise<OpeningQuestionsResult>;
        deeperQuestion: (input: DeeperQuestionInput) => Promise<DeeperQuestionResult>;
      };
    };
  }
}
