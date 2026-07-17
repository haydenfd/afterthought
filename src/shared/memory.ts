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

export type MemoryThreadKind =
  'present' | 'unresolved' | 'shifting' | 'steady' | 'progress';

export type MemoryThread = {
  id: string;
  title: string;
  summary: string;
  kind: MemoryThreadKind;
  sourceMemoryIds: string[];
  sourceEntryIds: string[];
  nextQuestion?: string;
};

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
  threads?: MemoryThread[];
  ingestion?: MemoryIngestionSummary;
  message?: string;
}
