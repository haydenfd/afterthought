/// <reference types="vite/client" />

declare global {
  interface Window {
    afterthought: {
      platform: string;
      versions: {
        chrome: string | undefined;
        electron: string | undefined;
      };
    };
  }
}
