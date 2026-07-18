export type Appearance = 'light' | 'dark';

export type Preferences = {
  installedAt?: string;
  onboardingCompletedAt?: string;
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
