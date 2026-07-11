import { contextBridge } from 'electron';

const afterthoughtApi = {
  platform: process.platform,
  versions: {
    chrome: process.versions.chrome,
    electron: process.versions.electron,
  },
} as const;

contextBridge.exposeInMainWorld('afterthought', afterthoughtApi);

export type AfterthoughtPreloadApi = typeof afterthoughtApi;
