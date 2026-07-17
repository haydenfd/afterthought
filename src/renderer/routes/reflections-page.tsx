import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { MemoryIndexStatus } from '@/components/memory/memory-index-status';
import { MemoryInsightStatus } from '@/components/memory/memory-insight-status';
import { MemoryPipelineNote } from '@/components/memory/memory-pipeline-note';
import { MemoryThreadList } from '@/components/memory/memory-thread-list';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { formatFullDate, formatRouteDate } from '@/lib/dates';
import type { JournalEntry } from '../../shared/journal-entry';
import type { MemoryRefreshResult } from '../../shared/memory';

const emptyMemory: MemoryRefreshResult = {
  status: 'online',
  profile: { static: [], dynamic: [] },
  memories: [],
};

export function ReflectionsPage() {
  const [memory, setMemory] = useState<MemoryRefreshResult>(emptyMemory);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRetrying, setIsRetrying] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [nextMemory, nextEntries] = await fetchMemoryPage();
      setMemory(nextMemory);
      setEntries(nextEntries);
    } catch {
      setMemory(offlineMemory());
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isCurrent = true;

    void fetchMemoryPage()
      .then(([nextMemory, nextEntries]) => {
        if (isCurrent) {
          setMemory(nextMemory);
          setEntries(nextEntries);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setMemory(offlineMemory());
          setEntries([]);
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const entriesById = useMemo(
    () => new Map(entries.map((entry) => [entry.id, entry])),
    [entries],
  );

  const retryIndexing = useCallback(async () => {
    setIsRetrying(true);
    try {
      await window.afterthought.memory.retryIngestion();
      await load();
    } catch {
      await load();
    } finally {
      setIsRetrying(false);
    }
  }, [load]);

  const threads = memory.threads ?? [];

  return (
    <section className="mx-auto min-h-screen max-w-4xl px-10 py-10">
      <header className="mb-9 flex items-start justify-between gap-6">
        <div>
          <p className="text-sm text-muted-foreground">Reflections</p>
          <h1 className="mt-1 text-3xl font-medium">Threads worth noticing</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
            Supermemory keeps the source moments; Groq helps arrange them into a few
            grounded threads and gentle questions. Open any source to read what you
            actually wrote.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={isLoading}
          onClick={() => void load()}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {isLoading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </header>

      {isLoading ? (
        <Card className="route-content-enter" aria-live="polite">
          <CardContent className="p-6 text-sm text-muted-foreground">
            Gathering remembered moments…
          </CardContent>
        </Card>
      ) : memory.status === 'offline' ? (
        <Card className="route-content-enter bg-background/55">
          <CardHeader>
            <CardTitle>Memory is resting</CardTitle>
            <CardDescription>{memory.message}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="route-content-enter space-y-8">
          <MemoryIndexStatus
            ingestion={memory.ingestion}
            isRetrying={isRetrying}
            onRetry={() => void retryIndexing()}
          />

          <MemoryPipelineNote />

          <MemoryInsightStatus insights={memory.insights} />

          {memory.message ? (
            <p className="text-sm text-muted-foreground" role="status">
              {memory.message}
            </p>
          ) : null}

          {threads.length > 0 ? (
            <section aria-labelledby="threads-heading">
              <div className="mb-4">
                <h2 id="threads-heading" className="text-xl font-medium">
                  A little perspective
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  These are invitations to look again, not conclusions about you.
                </p>
              </div>
              <MemoryThreadList
                threads={threads}
                memories={memory.memories}
                entriesById={entriesById}
              />
            </section>
          ) : null}

          {memory.memories.length > 0 ? (
            <section aria-labelledby="source-moments-heading">
              <div className="mb-4">
                <h2 id="source-moments-heading" className="text-xl font-medium">
                  Source moments
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  The Supermemory memories behind this view.
                </p>
              </div>
              <ul className="space-y-4">
                {memory.memories.map((item) => (
                  <li
                    key={item.id}
                    className="border-l border-border pl-5 writing-text text-xl leading-8"
                  >
                    {item.text}
                    <MemorySourceLink item={item} entriesById={entriesById} />
                  </li>
                ))}
              </ul>
            </section>
          ) : threads.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing has been remembered yet. Finish an entry and it will surface here.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}

async function loadEntries(): Promise<JournalEntry[]> {
  try {
    return await window.afterthought.entries.list();
  } catch {
    return [];
  }
}

async function fetchMemoryPage(): Promise<[MemoryRefreshResult, JournalEntry[]]> {
  return Promise.all([window.afterthought.memory.refresh(), loadEntries()]);
}

function MemorySourceLink({
  item,
  entriesById,
}: {
  item: MemoryRefreshResult['memories'][number];
  entriesById: Map<string, JournalEntry>;
}) {
  const sourceEntry = (item.sourceEntryIds ?? [])
    .map((entryId) => entriesById.get(entryId))
    .find((entry): entry is JournalEntry => Boolean(entry));

  if (sourceEntry) {
    return (
      <div className="mt-1 flex flex-wrap items-center gap-x-2 font-sans text-xs text-muted-foreground">
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

  return item.sourceDate ? (
    <span className="mt-1 block font-sans text-xs text-muted-foreground">
      {formatMemoryDate(item.sourceDate)}
    </span>
  ) : null;
}

function formatMemoryDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : formatFullDate(parsed);
}

function offlineMemory(): MemoryRefreshResult {
  return {
    status: 'offline',
    profile: { static: [], dynamic: [] },
    memories: [],
    message: 'Supermemory Local is unavailable. Your journal remains saved locally.',
  };
}
