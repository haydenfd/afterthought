export interface MemoryProfile {
  static: string[];
  dynamic: string[];
}

export interface MemoryItem {
  id: string;
  text: string;
  sourceDate?: string;
}

export interface MemoryRefreshResult {
  status: 'online' | 'offline';
  profile: MemoryProfile;
  memories: MemoryItem[];
  message?: string;
}
