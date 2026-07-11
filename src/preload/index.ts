import { contextBridge, ipcRenderer } from 'electron';

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
} as const;

contextBridge.exposeInMainWorld('afterthought', afterthoughtApi);

export type AfterthoughtPreloadApi = typeof afterthoughtApi;
