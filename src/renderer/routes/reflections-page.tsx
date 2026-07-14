import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { formatFullDate } from '@/lib/dates';
import type { MemoryRefreshResult } from '../../shared/memory';

const emptyMemory: MemoryRefreshResult = {
  status: 'online',
  profile: { static: [], dynamic: [] },
  memories: [],
};

export function ReflectionsPage() {
  const [memory, setMemory] = useState<MemoryRefreshResult>(emptyMemory);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      setMemory(await window.afterthought.memory.refresh());
    } catch {
      setMemory(offlineMemory());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isCurrent = true;

    void window.afterthought.memory
      .refresh()
      .then((result) => {
        if (isCurrent) {
          setMemory(result);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setMemory(offlineMemory());
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

  return (
    <section className="mx-auto min-h-screen max-w-4xl px-10 py-10">
      <header className="mb-9 flex items-start justify-between gap-6">
        <div>
          <p className="text-sm text-muted-foreground">Reflections</p>
          <h1 className="mt-1 text-3xl font-medium">What has been remembered</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
            Specific moments retained from your completed reflections, newest first.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={isLoading}
          onClick={() => void refresh()}
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
          {memory.message ? (
            <p className="text-sm text-muted-foreground" role="status">
              {memory.message}
            </p>
          ) : null}

          {memory.memories.length > 0 ? (
            <ul className="space-y-4">
              {memory.memories.map((item) => (
                <li
                  key={item.id}
                  className="border-l border-border pl-5 writing-text text-xl leading-8"
                >
                  {item.text}
                  {item.sourceDate ? (
                    <span className="mt-1 block font-sans text-xs text-muted-foreground">
                      {formatMemoryDate(item.sourceDate)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nothing has been remembered yet. Finish an entry and it will surface here.
            </p>
          )}
        </div>
      )}
    </section>
  );
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
