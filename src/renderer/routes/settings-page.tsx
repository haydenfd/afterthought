import { format } from 'date-fns';
import { Monitor, Moon, Sun, Wifi } from 'lucide-react';
import { useEffect, useState } from 'react';

import { SupermemoryStatus } from '@/components/supermemory/supermemory-status';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useSupermemory } from '@/state/supermemory-context';
import { type Appearance, useTheme } from '@/state/theme-context';

const appearanceOptions: Array<{
  value: Appearance;
  label: string;
  icon: typeof Sun;
}> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export function SettingsPage() {
  const { appearance, setAppearance } = useTheme();
  const {
    baseUrl,
    setBaseUrl,
    status,
    lastCheckedAt,
    connectionMessage,
    testConnection,
  } = useSupermemory();
  const [userName, setUserName] = useState('');
  const [isNameLoaded, setIsNameLoaded] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    void window.afterthought.preferences.get().then((preferences) => {
      if (isCurrent) {
        setUserName(preferences.userName ?? '');
        setIsNameLoaded(true);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, []);

  return (
    <section className="mx-auto min-h-screen max-w-4xl px-10 py-10">
      <header className="mb-9">
        <p className="text-sm text-muted-foreground">Settings</p>
        <h1 className="mt-1 text-3xl font-medium">Preferences</h1>
      </header>

      <div className="route-content-enter space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Name</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              id="user-name"
              value={userName}
              disabled={!isNameLoaded}
              onChange={(event) => setUserName(event.target.value)}
              onBlur={() => {
                void window.afterthought.preferences.set({
                  userName: userName.trim(),
                });
              }}
              placeholder="e.g. Jane Smith"
              spellCheck={false}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>
              Applies immediately and is remembered next time you open the app.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-3">
              {appearanceOptions.map((option) => (
                <Button
                  key={option.value}
                  type="button"
                  variant={appearance === option.value ? 'default' : 'outline'}
                  className={cn(
                    'justify-start',
                    appearance === option.value && 'text-primary-foreground',
                  )}
                  onClick={() => setAppearance(option.value)}
                >
                  <option.icon className="h-4 w-4" aria-hidden="true" />
                  {option.label}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Local memory</CardTitle>
            <CardDescription>
              Supermemory indexes your authored reflections so new sessions can connect
              with what you have shared before. Connection and indexing are separate:
              the You and Reflections pages show whether saved entries are ready.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="supermemory-url">Local URL</Label>
              <Input
                id="supermemory-url"
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                spellCheck={false}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background/55 p-3">
              <div className="space-y-1">
                <SupermemoryStatus status={status} />
                {lastCheckedAt ? (
                  <p className="text-xs text-muted-foreground">
                    As of {format(lastCheckedAt, 'p')}
                  </p>
                ) : null}
                {connectionMessage ? (
                  <p className="text-xs text-muted-foreground">{connectionMessage}</p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void testConnection();
                }}
              >
                <Wifi className="h-4 w-4" aria-hidden="true" />
                Test connection
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
