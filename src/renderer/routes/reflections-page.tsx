import { useEffect, useMemo, useState } from 'react';

import { MemoryInsightStatus } from '@/components/memory/memory-insight-status';
import { MemoryThreadList } from '@/components/memory/memory-thread-list';
import { RecurringThemes } from '@/components/memory/recurring-themes';
import { TemporalMirror } from '@/components/memory/temporal-mirror';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
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

  const threads = memory.threads ?? [];

  return (
    <section className="mx-auto min-h-screen max-w-4xl px-10 py-10">
      <header className="mb-9">
        <div>
          <h1 className="text-3xl font-medium">Reflections</h1>
        </div>
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
          <MemoryInsightStatus insights={memory.insights} />

          <TemporalMirror entriesById={entriesById} />

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

          {threads.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing has been distilled yet. Finish an entry and it will surface here.
            </p>
          ) : null}

          <RecurringThemes entries={entries} />
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
