export interface MemoryProfile {
  static: string[];
  dynamic: string[];
}

export interface MemoryItem {
  id: string;
  text: string;
  sourceDate?: string;
  sourceDocumentIds?: string[];
  sourceEntryIds?: string[];
}

export type MemoryDocumentStatus =
  | 'unknown'
  | 'queued'
  | 'extracting'
  | 'chunking'
  | 'embedding'
  | 'indexing'
  | 'done'
  | 'failed';

export type MemoryIngestionState = 'pending' | 'processing' | 'complete' | 'failed';

export type MemoryIngestionRecord = {
  state: MemoryIngestionState;
  updatedAt: string;
  attempts: number;
  remoteDocumentId?: string;
  remoteStatus?: MemoryDocumentStatus;
  error?: string;
};

export type MemoryIngestionSummary = {
  status: 'ready' | 'processing' | 'attention';
  pending: number;
  processing: number;
  failed: number;
  complete: number;
  message?: string;
};

export interface MemoryRefreshResult {
  status: 'online' | 'offline';
  profile: MemoryProfile;
  memories: MemoryItem[];
  ingestion?: MemoryIngestionSummary;
  message?: string;
}
