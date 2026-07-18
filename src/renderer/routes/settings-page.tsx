import { format } from 'date-fns';
import { Check, KeyRound, Moon, Pencil, Sun, Wifi } from 'lucide-react';
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
import type { GroqApiKeyStatus } from '../../shared/preferences';

const appearanceOptions: Array<{
  value: Appearance;
  label: string;
  icon: typeof Sun;
}> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
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
  const [groqApiKey, setGroqApiKey] = useState('');
  const [groqStatus, setGroqStatus] = useState<GroqApiKeyStatus | null>(null);
  const [isGroqKeyEditing, setIsGroqKeyEditing] = useState(true);
  const [groqAction, setGroqAction] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    'idle',
  );
  const [groqMessage, setGroqMessage] = useState('');

  useEffect(() => {
    let isCurrent = true;

    void Promise.all([
      window.afterthought.preferences.get(),
      window.afterthought.groq.getStatus(),
      window.afterthought.groq.getApiKey(),
    ]).then(([preferences, status, apiKey]) => {
      if (!isCurrent) {
        return;
      }

      setUserName(preferences.userName ?? '');
      setGroqStatus(status);
      setGroqApiKey(apiKey ?? '');
      setIsGroqKeyEditing(!status.configured || !apiKey);
      setIsNameLoaded(true);
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
            <CardTitle>Groq reflection layer</CardTitle>
            <CardDescription>
              Required for adaptive questions and reflections.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="groq-api-key">API key</Label>
              <div className="relative">
                <Input
                  id="groq-api-key"
                  type="password"
                  autoComplete="off"
                  value={groqApiKey}
                  readOnly={!isGroqKeyEditing}
                  disabled={groqStatus === null || groqAction === 'saving'}
                  onClick={() => {
                    if (!isGroqKeyEditing) {
                      setIsGroqKeyEditing(true);
                    }
                  }}
                  onChange={(event) => {
                    setGroqApiKey(event.target.value);
                    setGroqAction('idle');
                    setGroqMessage('');
                  }}
                  placeholder="Paste your Groq API key"
                  className={cn(!isGroqKeyEditing && 'cursor-pointer pr-10')}
                  spellCheck={false}
                />
                {groqStatus?.configured && !isGroqKeyEditing ? (
                  <button
                    type="button"
                    aria-label="Edit Groq API key"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => setIsGroqKeyEditing(true)}
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                {groqStatus?.configured ? (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Check
                      className="h-3.5 w-3.5 text-emerald-600"
                      aria-hidden="true"
                    />
                    Groq key configured
                  </p>
                ) : (
                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                    Groq key required
                  </p>
                )}
                {groqStatus?.message ? (
                  <p className="max-w-xl text-xs text-muted-foreground">
                    {groqStatus.message}
                  </p>
                ) : null}
                {groqMessage ? (
                  <p
                    className={cn(
                      'text-xs',
                      groqAction === 'error'
                        ? 'text-destructive'
                        : 'text-emerald-700 dark:text-emerald-400',
                    )}
                    role="status"
                  >
                    {groqMessage}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  disabled={
                    !groqApiKey.trim() ||
                    groqStatus === null ||
                    groqAction === 'saving' ||
                    (groqStatus.configured && !isGroqKeyEditing)
                  }
                  onClick={() => {
                    setGroqAction('saving');
                    setGroqMessage('');
                    void window.afterthought.groq
                      .setApiKey(groqApiKey)
                      .then((status) => {
                        setGroqStatus(status);
                        setIsGroqKeyEditing(false);
                        setGroqAction('saved');
                        setGroqMessage('Groq key saved.');
                      })
                      .catch((error: unknown) => {
                        setGroqAction('error');
                        setGroqMessage(
                          error instanceof Error
                            ? error.message
                            : 'The Groq key could not be saved.',
                        );
                      });
                  }}
                >
                  {groqAction === 'saved' ? (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <KeyRound className="h-4 w-4" aria-hidden="true" />
                  )}
                  {groqAction === 'saving' ? 'Saving…' : 'Save key'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2">
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
            <CardTitle>Supermemory connection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="supermemory-url">Connection URL</Label>
              <Input
                id="supermemory-url"
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                spellCheck={false}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background/55 p-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <SupermemoryStatus status={status} />
                  {lastCheckedAt ? (
                    <span className="text-xs text-muted-foreground">
                      As of {format(lastCheckedAt, 'p')}
                    </span>
                  ) : null}
                </div>
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
