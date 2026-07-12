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

  const profileItems = [...memory.profile.dynamic, ...memory.profile.static];

  return (
    <section className="mx-auto min-h-screen max-w-4xl px-10 py-10">
      <header className="mb-9 flex items-start justify-between gap-6">
        <div>
          <p className="text-sm text-muted-foreground">Reflections</p>
          <h1 className="mt-1 text-3xl font-medium">Your remembered patterns</h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
            Memories extracted from completed entries by Supermemory Local.
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
        <Card aria-live="polite">
          <CardContent className="p-6 text-sm text-muted-foreground">
            Gathering your local memories…
          </CardContent>
        </Card>
      ) : memory.status === 'offline' ? (
        <Card className="bg-background/55">
          <CardHeader>
            <CardTitle>Memory is resting</CardTitle>
            <CardDescription>{memory.message}</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-8">
          {memory.message ? (
            <p className="text-sm text-muted-foreground" role="status">
              {memory.message}
            </p>
          ) : null}

          <section aria-labelledby="profile-heading">
            <h2 id="profile-heading" className="text-sm font-medium">
              Living profile
            </h2>
            <p className="mb-4 mt-1 text-xs text-muted-foreground">
              A synthesized view of who you are, drawn from everything remembered so
              far.
            </p>
            {profileItems.length > 0 ? (
              <Card className="bg-card">
                <CardContent className="space-y-4 p-6">
                  {profileItems.map((item) => (
                    <p key={item} className="writing-text text-xl leading-8">
                      {item}
                    </p>
                  ))}
                </CardContent>
              </Card>
            ) : (
              <p className="text-sm text-muted-foreground">
                Your profile will take shape as more entries are remembered.
              </p>
            )}
          </section>
        </div>
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
