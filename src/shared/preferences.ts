export type Appearance = 'light' | 'dark' | 'system';

export type Preferences = {
  installedAt?: string;
  userName?: string;
  appearance?: Appearance;
  supermemoryUrl?: string;
};
