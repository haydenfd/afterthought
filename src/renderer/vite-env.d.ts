/// <reference types="vite/client" />

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
  };
}
