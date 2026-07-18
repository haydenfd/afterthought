import type { JournalEntry } from '../shared/journal-entry';
import type {
  MemoryDocumentStatus,
  MemoryIngestionRecord,
  MemoryIngestionSummary,
} from '../shared/memory';
import type { EntryStorage } from './entry-storage';
import {
  createMemoryIngestionStorage,
  type MemoryIngestionStorage,
} from './memory-ingestion-storage';
import { JOURNAL_MEMORY_CONTAINER, type SupermemoryClient } from './supermemory-client';

const maximumAttempts = 3;
const documentPollAttempts = 12;
const documentPollIntervalMs = 750;

export interface JournalMemoryIngestor {
  ingestEntry(entry: JournalEntry): Promise<void>;
  start?: () => Promise<void>;
  getStatus?: () => Promise<MemoryIngestionSummary>;
  retryFailed?: () => Promise<MemoryIngestionSummary>;
}

export type JournalMemoryIngestorOptions = {
  entryStorage?: EntryStorage;
  stateStorage?: MemoryIngestionStorage;
};

export function createJournalMemoryIngestor(
  clientPromise: Promise<SupermemoryClient>,
  options: JournalMemoryIngestorOptions = {},
): JournalMemoryIngestor {
  const stateStorage = options.stateStorage ?? createMemoryIngestionStorage();
  const entries = new Map<string, JournalEntry>();
  let preparationPromise: Promise<void> | null = null;
  let drainPromise: Promise<void> | null = null;

  async function ingestEntry(entry: JournalEntry): Promise<void> {
    entries.set(entry.id, entry);
    const existing = (await stateStorage.list())[entry.id];
    await stateStorage.set(entry.id, {
      state: 'pending',
      updatedAt: new Date().toISOString(),
      attempts: existing?.attempts ?? 0,
      ...(existing?.remoteDocumentId
        ? { remoteDocumentId: existing.remoteDocumentId }
        : {}),
      ...(existing?.remoteStrategy ? { remoteStrategy: existing.remoteStrategy } : {}),
      ...(existing?.remoteStatus ? { remoteStatus: existing.remoteStatus } : {}),
    });

    return drain();
  }

  async function start(): Promise<void> {
    return drain();
  }

  async function getStatus(): Promise<MemoryIngestionSummary> {
    const records = await stateStorage.list();
    const values = Object.values(records);
    const pending = values.filter((record) => record.state === 'pending').length;
    const processing = values.filter((record) => record.state === 'processing').length;
    const failed = values.filter((record) => record.state === 'failed').length;
    const complete = values.filter((record) => record.state === 'complete').length;

    if (failed > 0) {
      return {
        status: 'attention',
        pending,
        processing,
        failed,
        complete,
        message: `${failed} ${failed === 1 ? 'reflection needs' : 'reflections need'} memory indexing attention.`,
      };
    }

    if (pending > 0 || processing > 0) {
      return {
        status: 'processing',
        pending,
        processing,
        failed,
        complete,
        message: 'Your recent reflections are still being indexed for future sessions.',
      };
    }

    return {
      status: 'ready',
      pending,
      processing,
      failed,
      complete,
      ...(complete > 0
        ? { message: 'Your saved reflections are ready to inform future sessions.' }
        : {}),
    };
  }

  async function retryFailed(): Promise<MemoryIngestionSummary> {
    const records = await stateStorage.list();
    await Promise.all(
      Object.entries(records)
        .filter(([, record]) => record.state === 'failed')
        .map(([entryId, record]) =>
          stateStorage.set(entryId, {
            state: 'pending',
            updatedAt: new Date().toISOString(),
            attempts: 0,
            ...(record.remoteDocumentId
              ? { remoteDocumentId: record.remoteDocumentId }
              : {}),
          }),
        ),
    );

    await drain();
    return getStatus();
  }

  async function drain(): Promise<void> {
    if (drainPromise) {
      return drainPromise;
    }

    drainPromise = (async () => {
      await prepare();
      await processPending();
    })().finally(() => {
      drainPromise = null;
    });

    return drainPromise;
  }

  async function prepare(): Promise<void> {
    if (preparationPromise) {
      return preparationPromise;
    }

    preparationPromise = (async () => {
      const localEntries = options.entryStorage
        ? await options.entryStorage.listEntries()
        : [];
      for (const entry of localEntries) {
        entries.set(entry.id, entry);
      }

      const records = await stateStorage.list();
      for (const entry of localEntries) {
        const record = records[entry.id];
        if (!record) {
          await stateStorage.set(entry.id, pendingRecord());
        } else if (record.state === 'processing') {
          await stateStorage.set(entry.id, {
            ...record,
            state: 'pending',
            updatedAt: new Date().toISOString(),
          });
        }
      }

      await reconcileRemoteDocuments(localEntries);
    })().catch((error: unknown) => {
      console.warn('Could not prepare Supermemory journal indexing.', error);
    });

    return preparationPromise;
  }

  async function reconcileRemoteDocuments(localEntries: JournalEntry[]): Promise<void> {
    const client = await clientPromise.catch(() => null);
    if (!client?.documents.list || localEntries.length === 0) {
      return;
    }

    const localEntryIds = new Set(localEntries.map((entry) => entry.id));
    const remoteDocuments = await listRemoteDocuments(client).catch(() => []);
    const records = await stateStorage.list();

    for (const document of remoteDocuments) {
      const entryId = document.customId;
      if (!entryId || !localEntryIds.has(entryId)) {
        continue;
      }

      const existing = records[entryId] ?? pendingRecord();
      if (existing.remoteStrategy === 'direct-memory') {
        continue;
      }
      const remoteStatus = normalizeDocumentStatus(document.status);
      const nextState = remoteStatus === 'done' ? 'complete' : 'pending';
      const existingWithoutError = withoutError(existing);
      await stateStorage.set(entryId, {
        ...existingWithoutError,
        state: nextState,
        updatedAt: new Date().toISOString(),
        remoteDocumentId: document.id,
        ...(remoteStatus ? { remoteStatus } : {}),
      });
    }
  }

  async function processPending(): Promise<void> {
    const records = await stateStorage.list();
    for (const [entryId, record] of Object.entries(records)) {
      if (
        (record.state !== 'pending' &&
          !(record.state === 'failed' && record.attempts < maximumAttempts)) ||
        !entries.has(entryId)
      ) {
        continue;
      }

      await processEntry(entries.get(entryId)!, record);
    }
  }

  async function processEntry(
    entry: JournalEntry,
    current: MemoryIngestionRecord,
  ): Promise<void> {
    const attempts = current.attempts + 1;
    let activeRemoteDocumentId = current.remoteDocumentId;
    const currentWithoutError = withoutError(current);
    await stateStorage.set(entry.id, {
      ...currentWithoutError,
      state: 'processing',
      updatedAt: new Date().toISOString(),
      attempts,
    });

    try {
      const client = await clientPromise;
      const request = createDocumentRequest(entry);
      const remote = await upsertRemoteDocument(client, current, request);
      const remoteDocumentId = remote.id ?? current.remoteDocumentId;
      activeRemoteDocumentId = remoteDocumentId;
      const remoteStatus = normalizeDocumentStatus(remote.status);

      if (!remoteDocumentId) {
        throw new Error('Supermemory did not return a document id.');
      }

      await stateStorage.set(entry.id, {
        state: 'processing',
        updatedAt: new Date().toISOString(),
        attempts,
        remoteDocumentId,
        ...(remoteStatus ? { remoteStatus } : {}),
      });

      const finalDocument = await waitForDocument(
        client,
        remoteDocumentId,
        remoteStatus,
      );
      if (finalDocument.status === 'failed') {
        const directMemory = await createDirectMemory(client, request);
        await stateStorage.set(entry.id, {
          state: 'complete',
          updatedAt: new Date().toISOString(),
          attempts,
          remoteDocumentId: directMemory.documentId,
          remoteStrategy: 'direct-memory',
          remoteStatus: 'done',
        });
        return;
      }

      await stateStorage.set(entry.id, {
        state: 'complete',
        updatedAt: new Date().toISOString(),
        attempts,
        remoteDocumentId,
        remoteStrategy: 'document',
        ...(finalDocument.status ? { remoteStatus: finalDocument.status } : {}),
      });
    } catch (error: unknown) {
      await stateStorage.set(entry.id, {
        state: 'failed',
        updatedAt: new Date().toISOString(),
        attempts,
        ...(activeRemoteDocumentId ? { remoteDocumentId: activeRemoteDocumentId } : {}),
        error: errorMessage(error),
      });
    }
  }

  async function upsertRemoteDocument(
    client: SupermemoryClient,
    current: MemoryIngestionRecord,
    request: ReturnType<typeof createDocumentRequest>,
  ): Promise<{ id?: string; status?: string }> {
    if (current.remoteDocumentId && client.documents.get) {
      const existing = await client.documents.get(current.remoteDocumentId);
      const status = normalizeDocumentStatus(existing.status);

      if (status === 'done') {
        return { id: existing.id, status };
      }

      if (status !== 'failed') {
        return {
          id: existing.id,
          ...(status ? { status } : {}),
        };
      }

      if (client.documents.update) {
        return normalizeWriteResult(
          await client.documents.update(current.remoteDocumentId, request),
          current.remoteDocumentId,
        );
      }
    }

    const added = normalizeWriteResult(await client.documents.add(request));
    if (added.id && added.status === 'failed' && client.documents.update) {
      return normalizeWriteResult(
        await client.documents.update(added.id, request),
        added.id,
      );
    }

    return added;
  }

  async function createDirectMemory(
    client: SupermemoryClient,
    request: ReturnType<typeof createDocumentRequest>,
  ): Promise<{ documentId: string }> {
    const response = await client.post<{
      documentId?: string | null;
      memories?: unknown[];
    }>('/v4/memories', {
      body: {
        containerTag: request.containerTag,
        memories: [
          {
            content: request.content,
            isStatic: false,
            metadata: request.metadata,
            temporalContext: {
              documentDate: request.metadata.sourceDate,
            },
          },
        ],
      },
    });

    if (!response.documentId) {
      throw new Error('Supermemory did not return a direct memory document id.');
    }

    return { documentId: response.documentId };
  }

  async function waitForDocument(
    client: SupermemoryClient,
    documentId: string,
    initialStatus: MemoryDocumentStatus | undefined,
  ): Promise<{ status?: MemoryDocumentStatus }> {
    if (initialStatus === 'done' || initialStatus === 'failed') {
      return { status: initialStatus };
    }

    if (!client.documents.get) {
      return { ...(initialStatus ? { status: initialStatus } : {}) };
    }

    let status: MemoryDocumentStatus | undefined = initialStatus;
    for (let attempt = 0; attempt < documentPollAttempts; attempt += 1) {
      await sleep(documentPollIntervalMs);
      const document = await client.documents.get(documentId);
      status = normalizeDocumentStatus(document.status);
      if (status === 'done' || status === 'failed') {
        return { status };
      }
    }

    throw new Error(
      `Supermemory is still processing this reflection (${status ?? 'unknown'}).`,
    );
  }

  return { ingestEntry, start, getStatus, retryFailed };
}

function createDocumentRequest(entry: JournalEntry): {
  content: string;
  containerTag: string;
  customId: string;
  metadata: Record<string, string>;
} {
  return {
    content: formatEntryForMemory(entry),
    containerTag: JOURNAL_MEMORY_CONTAINER,
    customId: entry.id,
    metadata: {
      source: 'afterthought-journal',
      entryId: entry.id,
      sourceDate: entry.createdAt,
      localDate: entry.createdAt.slice(0, 10),
      ...(entry.themes?.length ? { themes: entry.themes.join(', ') } : {}),
    },
  };
}

/**
 * Prompts are local provenance, not user memories. Supermemory should receive
 * only the person's authored reflection so generated language cannot become a
 * false memory. Older deeper responses remain valid authored context.
 */
export function formatEntryForMemory(entry: JournalEntry): string {
  const lines = [
    `Journal reflection — ${entry.createdAt.slice(0, 10)}`,
    '',
    entry.content,
  ];

  if (entry.deeperReflection?.response?.trim()) {
    lines.push('', 'Follow-up reflection:', entry.deeperReflection.response.trim());
  }

  return lines.join('\n');
}

async function listRemoteDocuments(
  client: SupermemoryClient,
): Promise<Array<{ id: string; customId?: string | null; status?: string }>> {
  if (!client.documents.list) {
    return [];
  }

  const documents: Array<{ id: string; customId?: string | null; status?: string }> =
    [];
  for (let page = 1; page <= 10; page += 1) {
    const response = await client.documents.list({
      containerTags: [JOURNAL_MEMORY_CONTAINER],
      limit: 100,
      page,
    });
    const pageDocuments =
      response.memories ?? response.documents ?? response.results ?? [];
    documents.push(...pageDocuments);
    if (pageDocuments.length < 100) {
      break;
    }
  }

  return documents;
}

function normalizeWriteResult(
  value: unknown,
  fallbackId?: string,
): { id?: string; status?: string } {
  if (!value || typeof value !== 'object') {
    return fallbackId ? { id: fallbackId } : {};
  }

  const record = value as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id : fallbackId;
  return {
    ...(id ? { id } : {}),
    ...(typeof record.status === 'string' ? { status: record.status } : {}),
  };
}

function normalizeDocumentStatus(value: unknown): MemoryDocumentStatus | undefined {
  return value === 'unknown' ||
    value === 'queued' ||
    value === 'extracting' ||
    value === 'chunking' ||
    value === 'embedding' ||
    value === 'indexing' ||
    value === 'done' ||
    value === 'failed'
    ? value
    : undefined;
}

function pendingRecord(): MemoryIngestionRecord {
  return {
    state: 'pending',
    updatedAt: new Date().toISOString(),
    attempts: 0,
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown Supermemory indexing error.';
}

function withoutError(
  record: MemoryIngestionRecord,
): Omit<MemoryIngestionRecord, 'error'> {
  const copy = { ...record };
  delete copy.error;
  return copy;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
