import { format } from 'date-fns';
import { Monitor, Moon, Sun, Wifi } from 'lucide-react';

import { SupermemoryStatus } from '@/components/supermemory-status';
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
import { Separator } from '@/components/ui/separator';
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
  const { baseUrl, setBaseUrl, status, lastCheckedAt, testConnection } =
    useSupermemory();

  return (
    <section className="mx-auto min-h-screen max-w-4xl px-10 py-10">
      <header className="mb-9">
        <p className="text-sm text-muted-foreground">Settings</p>
        <h1 className="mt-1 text-3xl font-medium">Preferences</h1>
      </header>

      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Session-only until persistence is added.</CardDescription>
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
            <CardTitle>Supermemory Local</CardTitle>
            <CardDescription>
              Default local URL for the placeholder memory client.
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
                    Last checked {format(lastCheckedAt, 'p')}
                  </p>
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

        <Card>
          <CardHeader>
            <CardTitle>About Afterthought</CardTitle>
            <CardDescription>
              A reflective desktop journal shell for daily writing and eventual
              longitudinal memory.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Separator />
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground">Version</span>
              <span>0.1.0 placeholder</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
