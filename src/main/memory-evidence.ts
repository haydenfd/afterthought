import type { MemoryEvidenceItem } from '../shared/reflection';
import { JOURNAL_MEMORY_CONTAINER, type SupermemoryClient } from './supermemory-client';

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const documentsPageSize = 100;

interface EvidenceSearchOptions {
  limit: number;
  minimumSimilarity: number;
}

interface DocumentListPage {
  documents?: unknown[];
  memories?: unknown[];
  results?: unknown[];
  pagination?: {
    currentPage?: number;
    totalPages?: number;
    nextCursor?: string | null;
  };
  nextCursor?: string | null;
}

interface UnresolvedMemoryEvidence extends MemoryEvidenceItem {
  documentReferences: unknown[];
}

export async function retrieveMemoryEvidence(
  client: SupermemoryClient,
  queries: string[],
  options: EvidenceSearchOptions,
): Promise<MemoryEvidenceItem[]> {
  const selectedQueries = queries.map((query) => query.trim()).filter(Boolean);
  if (selectedQueries.length === 0) {
    return [];
  }

  const responses = await Promise.allSettled(
    selectedQueries.map((query) =>
      client.search.memories({
        q: query,
        containerTag: JOURNAL_MEMORY_CONTAINER,
        limit: options.limit,
        rerank: true,
        include: { documents: true },
      }),
    ),
  );
  const evidence = new Map<string, UnresolvedMemoryEvidence>();

  for (const response of responses) {
    if (response.status === 'rejected') {
      continue;
    }

    for (const result of response.value.results) {
      const normalized = normalizeSearchResult(result, options.minimumSimilarity);
      if (!normalized) {
        continue;
      }

      const existing = evidence.get(normalized.id);
      if (!existing || normalized.similarity > existing.similarity) {
        evidence.set(normalized.id, {
          ...normalized,
          documentReferences: [...normalized.documentReferences],
        });
      } else {
        existing.sourceDocumentIds = uniqueStrings([
          ...existing.sourceDocumentIds,
          ...normalized.sourceDocumentIds,
        ]);
        existing.sourceEntryIds = uniqueStrings([
          ...existing.sourceEntryIds,
          ...normalized.sourceEntryIds,
        ]);
        existing.documentReferences = [
          ...existing.documentReferences,
          ...normalized.documentReferences,
        ];
        if (!existing.sourceDate && normalized.sourceDate) {
          existing.sourceDate = normalized.sourceDate;
        }
      }
    }
  }

  const resolved = await resolveEvidenceSourceEntries(client, [...evidence.values()]);
  return resolved.sort((left, right) => right.similarity - left.similarity);
}

export function normalizeSearchResult(
  value: unknown,
  minimumSimilarity: number,
): UnresolvedMemoryEvidence | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }

  const id = typeof record.id === 'string' ? record.id.trim() : '';
  const text = [record.memory, record.text, record.content].find(
    (candidate): candidate is string =>
      typeof candidate === 'string' && candidate.trim().length > 0,
  );
  const similarity = typeof record.similarity === 'number' ? record.similarity : NaN;
  if (!id || !text || !Number.isFinite(similarity) || similarity < minimumSimilarity) {
    return null;
  }

  const documents = Array.isArray(record.documents) ? record.documents : [];
  const metadata = asRecord(record.metadata);
  const sourceDocumentIds = uniqueStrings(
    documents
      .map((document) => {
        const documentRecord = asRecord(document);
        return typeof documentRecord?.id === 'string' ? documentRecord.id : null;
      })
      .filter((documentId): documentId is string => !!documentId),
  );
  const sourceEntryIds = uniqueStrings([
    ...documents.flatMap(resolveEntryIdsFromDocument),
    stringValue(metadata?.entryId) ?? '',
    stringValue(metadata?.sourceEntryId) ?? '',
  ]);
  const sourceDate =
    stringValue(metadata?.sourceDate) ??
    documents
      .map((document) =>
        stringValue(asRecord(asRecord(document)?.metadata)?.sourceDate),
      )
      .find((value): value is string => !!value);

  return {
    id,
    text: text.trim(),
    similarity,
    ...(sourceDate ? { sourceDate } : {}),
    sourceDocumentIds,
    sourceEntryIds,
    documentReferences: documents,
  };
}

async function resolveEvidenceSourceEntries(
  client: SupermemoryClient,
  evidence: UnresolvedMemoryEvidence[],
): Promise<MemoryEvidenceItem[]> {
  const unresolvedDocumentIds = uniqueStrings(
    evidence.flatMap((item) => item.sourceDocumentIds),
  );
  if (unresolvedDocumentIds.length === 0) {
    return stripDocumentReferences(evidence);
  }

  const documentMap = await listJournalDocuments(client).catch(
    () => new Map<string, unknown>(),
  );
  for (const item of evidence) {
    const resolvedEntryIds = item.sourceDocumentIds.flatMap((documentId) => {
      const document = documentMap.get(documentId);
      return document ? resolveEntryIdsFromDocument(document) : [];
    });
    item.sourceEntryIds = uniqueStrings([...item.sourceEntryIds, ...resolvedEntryIds]);
  }

  return stripDocumentReferences(evidence);
}

async function listJournalDocuments(
  client: SupermemoryClient,
): Promise<Map<string, unknown>> {
  const documents = new Map<string, unknown>();
  let page = 1;
  let cursor: string | undefined;

  for (;;) {
    const response = await client.post<DocumentListPage>('/v3/documents/list', {
      body: {
        containerTags: [JOURNAL_MEMORY_CONTAINER],
        limit: documentsPageSize,
        page,
        ...(cursor ? { cursor } : {}),
      },
    });
    const pageDocuments = Array.isArray(response.documents)
      ? response.documents
      : Array.isArray(response.memories)
        ? response.memories
        : Array.isArray(response.results)
          ? response.results
          : [];

    for (const document of pageDocuments) {
      const record = asRecord(document);
      if (typeof record?.id === 'string') {
        documents.set(record.id, document);
      }
    }

    const nextCursor = response.nextCursor ?? response.pagination?.nextCursor;
    const currentPage = response.pagination?.currentPage ?? page;
    const totalPages = response.pagination?.totalPages ?? currentPage;

    if (nextCursor) {
      cursor = nextCursor;
      page += 1;
      continue;
    }

    if (currentPage < totalPages) {
      page = currentPage + 1;
      continue;
    }

    return documents;
  }
}

function stripDocumentReferences(
  evidence: UnresolvedMemoryEvidence[],
): MemoryEvidenceItem[] {
  return evidence.map((item) => ({
    id: item.id,
    text: item.text,
    similarity: item.similarity,
    ...(item.sourceDate ? { sourceDate: item.sourceDate } : {}),
    sourceDocumentIds: item.sourceDocumentIds,
    sourceEntryIds: item.sourceEntryIds,
  }));
}

function resolveEntryIdsFromDocument(document: unknown): string[] {
  const record = asRecord(document);
  if (!record) {
    return [];
  }

  const metadata = asRecord(record.metadata);
  return uniqueStrings(
    [record.customId, metadata?.entryId, metadata?.customId]
      .map(stringValue)
      .filter((entryId): entryId is string => !!entryId && uuidPattern.test(entryId)),
  );
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}
