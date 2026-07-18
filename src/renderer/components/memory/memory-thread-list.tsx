import { Link } from 'react-router-dom';

import { formatFullDate, formatRouteDate } from '@/lib/dates';
import type { JournalEntry } from '../../../shared/journal-entry';
import type { MemoryItem, MemoryThread } from '../../../shared/memory';

const kindLabels: Record<MemoryThread['kind'], string> = {
  present: 'Present now',
  unresolved: 'Still open',
  shifting: 'In motion',
  steady: 'Holding steady',
  progress: 'A small change',
};

export function MemoryThreadList({
  threads,
  memories,
  entriesById,
}: {
  threads: MemoryThread[];
  memories: MemoryItem[];
  entriesById: Map<string, JournalEntry>;
}) {
  const memoriesById = new Map(memories.map((memory) => [memory.id, memory]));

  return (
    <div className="space-y-5">
      {threads.map((thread) => (
        <article
          key={thread.id}
          className="rounded-lg border border-border bg-card/55 p-5"
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              {kindLabels[thread.kind]}
            </p>
            <span className="text-xs text-muted-foreground/60" aria-hidden="true">
              ·
            </span>
            <p className="text-xs text-muted-foreground">
              {thread.sourceMemoryIds.length}{' '}
              {thread.sourceMemoryIds.length === 1 ? 'source moment' : 'source moments'}
            </p>
          </div>
          <h3 className="mt-3 text-xl font-medium">{thread.title}</h3>
          <p className="mt-3 max-w-2xl writing-text text-lg leading-8 text-foreground/90">
            {thread.summary}
          </p>
          {thread.nextQuestion ? (
            <p className="mt-4 max-w-2xl border-l border-primary/45 pl-4 writing-text text-lg italic leading-8 text-muted-foreground">
              {thread.nextQuestion}
            </p>
          ) : null}
          <SourceReferences
            memoryIds={thread.sourceMemoryIds}
            memoriesById={memoriesById}
            entriesById={entriesById}
          />
        </article>
      ))}
    </div>
  );
}

function SourceReferences({
  memoryIds,
  memoriesById,
  entriesById,
}: {
  memoryIds: string[];
  memoriesById: Map<string, MemoryItem>;
  entriesById: Map<string, JournalEntry>;
}) {
  const references: Array<{ date: string; href?: string }> = memoryIds.flatMap(
    (memoryId) => {
      const memory = memoriesById.get(memoryId);
      if (!memory) {
        return [];
      }

      const sourceEntries = (memory.sourceEntryIds ?? [])
        .map((entryId) => entriesById.get(entryId))
        .filter((entry): entry is JournalEntry => Boolean(entry));

      if (sourceEntries.length > 0) {
        return sourceEntries.map((entry) => ({
          date: entry.createdAt,
          href: `/calendar/${formatRouteDate(new Date(entry.createdAt))}`,
        }));
      }

      return memory.sourceDate ? [{ date: memory.sourceDate }] : [];
    },
  );

  const uniqueReferences = references.filter(
    (reference, index) =>
      references.findIndex(
        (candidate) =>
          candidate.date === reference.date && candidate.href === reference.href,
      ) === index,
  );

  if (uniqueReferences.length === 0) {
    return null;
  }

  return (
    <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border/75 pt-3 text-xs text-muted-foreground/75">
      {uniqueReferences.map((reference, index) => (
        <span key={`${reference.date}-${reference.href ?? 'date'}-${index}`}>
          {index > 0 ? <span aria-hidden="true"> · </span> : null}
          <span>{formatMemoryDate(reference.date)}</span>
          {reference.href ? (
            <>
              <span aria-hidden="true"> · </span>
              <Link
                to={reference.href}
                className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                View source entry
              </Link>
            </>
          ) : null}
        </span>
      ))}
    </div>
  );
}

function formatMemoryDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : formatFullDate(parsed);
}
