export type Appearance = 'light' | 'dark' | 'system';

export type Preferences = {
  installedAt?: string;
  userName?: string;
  appearance?: Appearance;
  supermemoryUrl?: string;
};

export type GroqApiKeyStatus = {
  configured: boolean;
  secureStorageAvailable: boolean;
  maskedKey?: string;
  message?: string;
};
