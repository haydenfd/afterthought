import { contextBridge, ipcRenderer } from 'electron';

import type { CreateJournalEntryInput, JournalEntry } from '../shared/journal-entry';

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
} as const;

contextBridge.exposeInMainWorld('afterthought', afterthoughtApi);

export type AfterthoughtPreloadApi = typeof afterthoughtApi;
