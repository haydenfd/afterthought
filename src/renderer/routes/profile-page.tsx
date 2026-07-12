import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { MemoryRefreshResult } from '../../shared/memory';

const emptyMemory: MemoryRefreshResult = {
  status: 'online',
  profile: { static: [], dynamic: [] },
  memories: [],
};

export function ProfilePage() {
  const [memory, setMemory] = useState<MemoryRefreshResult>(emptyMemory);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
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

  const shifting = memory.profile.dynamic;
  const enduring = memory.profile.static;
  const hasProfile = shifting.length > 0 || enduring.length > 0;

  return (
    <section className="mx-auto min-h-screen max-w-3xl px-10 py-10">
      <header className="mb-10 flex items-start justify-between gap-6">
        <div className="max-w-2xl">
          <p className="text-sm text-muted-foreground">You</p>
          <h1 className="mt-1 text-3xl font-medium">Who you seem to be becoming</h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Drawn only from what you have written, remembered on this machine. Nothing
            here was authored for you.
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
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Reading back through what you have shared…
        </p>
      ) : memory.status === 'offline' ? (
        <Card className="bg-background/55">
          <CardHeader>
            <CardTitle>This portrait is resting</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground">
            {memory.message}
          </CardContent>
        </Card>
      ) : hasProfile ? (
        <div className="space-y-12">
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
                  <p key={line} className="writing-text text-xl leading-8 text-foreground">
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
      ) : (
        <p className="max-w-xl writing-text text-xl leading-8 text-muted-foreground">
          This page is quiet for now. As you keep writing, a portrait of who you are will
          take shape here — recurring themes, what is changing, what stays constant.
        </p>
      )}
    </section>
  );
}

function offlineMemory(): MemoryRefreshResult {
  return {
    status: 'offline',
    profile: { static: [], dynamic: [] },
    memories: [],
    message: 'Supermemory Local is unavailable. Your journal remains saved locally.',
  };
}
