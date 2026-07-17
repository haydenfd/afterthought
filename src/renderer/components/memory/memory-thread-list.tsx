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
          <div className="mt-5 border-t border-border/75 pt-4">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground/75">
              Grounded in
            </p>
            <ul className="mt-3 space-y-3">
              {thread.sourceMemoryIds.map((memoryId) => {
                const memory = memoriesById.get(memoryId);
                return memory ? (
                  <li
                    key={memory.id}
                    className="text-sm leading-6 text-muted-foreground"
                  >
                    <p>{previewMemory(memory.text)}</p>
                    <SourceReference memory={memory} entriesById={entriesById} />
                  </li>
                ) : null;
              })}
            </ul>
          </div>
        </article>
      ))}
    </div>
  );
}

function SourceReference({
  memory,
  entriesById,
}: {
  memory: MemoryItem;
  entriesById: Map<string, JournalEntry>;
}) {
  const sourceEntry = (memory.sourceEntryIds ?? [])
    .map((entryId) => entriesById.get(entryId))
    .find((entry): entry is JournalEntry => Boolean(entry));

  if (sourceEntry) {
    return (
      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground/75">
        <span>{formatMemoryDate(sourceEntry.createdAt)}</span>
        <span aria-hidden="true">·</span>
        <Link
          to={`/calendar/${formatRouteDate(new Date(sourceEntry.createdAt))}`}
          className="underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          View source entry
        </Link>
      </div>
    );
  }

  return memory.sourceDate ? (
    <span className="mt-1 block text-xs text-muted-foreground/75">
      {formatMemoryDate(memory.sourceDate)}
    </span>
  ) : null;
}

function previewMemory(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();

  if (normalized.length <= 240) {
    return normalized;
  }

  return `${normalized.slice(0, 237).trimEnd()}...`;
}

function formatMemoryDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : formatFullDate(parsed);
}
