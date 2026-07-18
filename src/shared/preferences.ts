export type Appearance = 'light' | 'dark' | 'system';

export type Preferences = {
  installedAt?: string;
  onboardingCompletedAt?: string;
  userName?: string;
  appearance?: Appearance;
  supermemoryUrl?: string;
};

export type GroqApiKeyStatus = {
  configured: boolean;
  valid?: boolean;
  secureStorageAvailable: boolean;
  maskedKey?: string;
  message?: string;
};
