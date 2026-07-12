export const SUPERMEMORY_LOCAL_URL = 'http://localhost:6767';

export type SupermemoryConnectionStatus = 'checking' | 'connected' | 'offline';

export type SupermemoryConnectionResult = {
  status: Exclude<SupermemoryConnectionStatus, 'checking'>;
  url: string;
  message?: string;
};
