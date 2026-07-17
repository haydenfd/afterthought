import { contextBridge, ipcRenderer } from 'electron';

import type { CreateJournalEntryInput, JournalEntry } from '../shared/journal-entry';
import type { MemoryRefreshResult } from '../shared/memory';
import type { GroqApiKeyStatus, Preferences } from '../shared/preferences';
import type {
  DeeperQuestionInput,
  DeeperQuestionResult,
  OpeningQuestionsResult,
} from '../shared/reflection';
import type { SupermemoryConnectionResult } from '../shared/supermemory';

const afterthoughtApi = {
  platform: process.platform,
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
  supermemory: {
    checkConnection: (url: string): Promise<SupermemoryConnectionResult> =>
      ipcRenderer.invoke('supermemory:check-connection', url),
  },
  entries: {
    create: (input: CreateJournalEntryInput): Promise<JournalEntry> =>
      ipcRenderer.invoke('entries:create', input),
    get: (id: string): Promise<JournalEntry | null> =>
      ipcRenderer.invoke('entries:get', id),
    list: (): Promise<JournalEntry[]> => ipcRenderer.invoke('entries:list'),
  },
  memory: {
    refresh: (): Promise<MemoryRefreshResult> => ipcRenderer.invoke('memory:refresh'),
    retryIngestion: (): Promise<MemoryRefreshResult['ingestion']> =>
      ipcRenderer.invoke('memory:retry-ingestion'),
  },
  groq: {
    getStatus: (): Promise<GroqApiKeyStatus> => ipcRenderer.invoke('groq:get-status'),
    setApiKey: (apiKey: string): Promise<GroqApiKeyStatus> =>
      ipcRenderer.invoke('groq:set-api-key', apiKey),
    clearApiKey: (): Promise<GroqApiKeyStatus> =>
      ipcRenderer.invoke('groq:clear-api-key'),
  },
  preferences: {
    get: (): Promise<Preferences> => ipcRenderer.invoke('preferences:get'),
    set: (update: Partial<Preferences>): Promise<Preferences> =>
      ipcRenderer.invoke('preferences:set', update),
  },
  reflection: {
    openingQuestions: (): Promise<OpeningQuestionsResult> =>
      ipcRenderer.invoke('reflection:opening-questions'),
    deeperQuestion: (input: DeeperQuestionInput): Promise<DeeperQuestionResult> =>
      ipcRenderer.invoke('reflection:deeper-question', input),
  },
} as const;

contextBridge.exposeInMainWorld('afterthought', afterthoughtApi);

export type AfterthoughtPreloadApi = typeof afterthoughtApi;
