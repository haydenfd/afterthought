import { contextBridge, ipcRenderer } from 'electron';

import type { CreateJournalEntryInput, JournalEntry } from '../shared/journal-entry';
import type { MemoryRefreshResult } from '../shared/memory';
import type { Preferences } from '../shared/preferences';
import type { OpeningQuestionsResult } from '../shared/reflection';

const afterthoughtApi = {
  platform: process.platform,
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
  supermemory: {
    checkConnection: (url: string) =>
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
  },
  preferences: {
    get: (): Promise<Preferences> => ipcRenderer.invoke('preferences:get'),
    set: (update: Partial<Preferences>): Promise<Preferences> =>
      ipcRenderer.invoke('preferences:set', update),
  },
  reflection: {
    openingQuestions: (): Promise<OpeningQuestionsResult> =>
      ipcRenderer.invoke('reflection:opening-questions'),
  },
} as const;

contextBridge.exposeInMainWorld('afterthought', afterthoughtApi);

export type AfterthoughtPreloadApi = typeof afterthoughtApi;
