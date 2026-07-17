import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { MemoryIndexStatus } from '@/components/memory/memory-index-status';
import { MemoryInsightStatus } from '@/components/memory/memory-insight-status';
import { MemoryThreadList } from '@/components/memory/memory-thread-list';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { JournalEntry } from '../../shared/journal-entry';
import type { MemoryRefreshResult } from '../../shared/memory';

const emptyMemory: MemoryRefreshResult = {
  status: 'online',
  profile: { static: [], dynamic: [] },
  memories: [],
};

export function ProfilePage() {
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

  const shifting = memory.profile.dynamic;
  const enduring = memory.profile.static;
  const threads = memory.threads ?? [];
  const hasProfile = shifting.length > 0 || enduring.length > 0;

  return (
    <section className="mx-auto min-h-screen max-w-4xl px-10 py-10">
      <header className="mb-10 flex items-start justify-between gap-6">
        <div className="max-w-2xl">
          <p className="text-sm text-muted-foreground">You</p>
          <h1 className="mt-1 text-3xl font-medium">A portrait in progress</h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Supermemory keeps the longer view of what you share. This page offers a
            cautious portrait of what may be changing and what may hold steady — never a
            verdict, and always allowed to be incomplete.
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
        <p
          className="route-content-enter text-sm text-muted-foreground"
          aria-live="polite"
        >
          Reading back through what you have shared…
        </p>
      ) : memory.status === 'offline' ? (
        <Card className="route-content-enter bg-background/55">
          <CardHeader>
            <CardTitle>This portrait is resting</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground">
            {memory.message}
          </CardContent>
        </Card>
      ) : (
        <div className="route-content-enter space-y-12">
          <MemoryIndexStatus
            ingestion={memory.ingestion}
            isRetrying={isRetrying}
            onRetry={() => void retryIndexing()}
          />

          <MemoryInsightStatus insights={memory.insights} />

          {memory.message ? (
            <p className="text-sm text-muted-foreground" role="status">
              {memory.message}
            </p>
          ) : null}

          {hasProfile ? (
            <div className="space-y-10">
              {shifting.length > 0 ? (
                <section aria-labelledby="shifting-heading">
                  <h2
                    id="shifting-heading"
                    className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground"
                  >
                    What seems to be shifting
                  </h2>
                  <div className="mt-4 space-y-4">
                    {shifting.map((line) => (
                      <p
                        key={line}
                        className="writing-text text-xl leading-8 text-foreground"
                      >
                        {line}
                      </p>
                    ))}
                  </div>
                </section>
              ) : null}

              {enduring.length > 0 ? (
                <section aria-labelledby="enduring-heading">
                  <h2
                    id="enduring-heading"
                    className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground"
                  >
                    What holds steady
                  </h2>
                  <div className="mt-4 space-y-4">
                    {enduring.map((line) => (
                      <p
                        key={line}
                        className="writing-text text-xl leading-8 text-foreground/90"
                      >
                        {line}
                      </p>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}

          {threads.length > 0 ? (
            <section aria-labelledby="profile-threads-heading">
              <div className="mb-4">
                <h2 id="profile-threads-heading" className="text-xl font-medium">
                  Threads shaping this portrait
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  A few current threads, with the memories that support them.
                </p>
              </div>
              <MemoryThreadList
                threads={threads}
                memories={memory.memories}
                entriesById={entriesById}
              />
            </section>
          ) : null}

          {!hasProfile && threads.length === 0 ? (
            <p className="max-w-xl writing-text text-xl leading-8 text-muted-foreground">
              This page is quiet for now. As you keep writing, a portrait can take shape
              here — recurring themes, what is changing, and what stays constant.
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

function offlineMemory(): MemoryRefreshResult {
  return {
    status: 'offline',
    profile: { static: [], dynamic: [] },
    memories: [],
    message: 'Supermemory Local is unavailable. Your journal remains saved locally.',
  };
}
