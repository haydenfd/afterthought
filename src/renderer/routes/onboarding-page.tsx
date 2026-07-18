import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Feather,
  KeyRound,
  Plus,
  RefreshCw,
  Settings,
  UserRound,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { GroqApiKeyStatus } from '../../shared/preferences';

type PreviewKind = 'welcome' | 'write' | 'reflect' | 'profile' | 'calendar';

type OnboardingSlide = {
  eyebrow: string;
  title: string;
  description: string;
  preview: PreviewKind;
};

const slides: OnboardingSlide[] = [
  {
    eyebrow: 'A quieter place to think',
    title: 'Welcome to Afterthought',
    description:
      'A private journal for noticing what is on your mind, then seeing what it connects to over time.',
    preview: 'welcome',
  },
  {
    eyebrow: 'Start with today',
    title: 'Write without performing',
    description:
      'Open a fresh page and follow the thought wherever it goes. Your entries are saved locally first, with optional memory continuity over time.',
    preview: 'write',
  },
  {
    eyebrow: 'Look back with care',
    title: 'Find the threads between days',
    description:
      'Afterthought brings your reflections together so recurring questions and quiet patterns become easier to notice.',
    preview: 'reflect',
  },
  {
    eyebrow: 'A portrait in progress',
    title: 'See who you are becoming',
    description:
      'Over time, your writing gathers into a cautious portrait of what is changing and what holds steady.',
    preview: 'profile',
  },
  {
    eyebrow: 'Before you begin',
    title: 'Add your Groq key',
    description:
      'Afterthought uses Groq for its reflection layer. Add a valid key to continue.',
    preview: 'calendar',
  },
];

export function OnboardingPage() {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [groqApiKey, setGroqApiKey] = useState('');
  const [groqStatus, setGroqStatus] = useState<GroqApiKeyStatus | null>(null);
  const [groqAction, setGroqAction] = useState<'idle' | 'saving' | 'error'>('idle');
  const [groqMessage, setGroqMessage] = useState('');
  const slide = slides[currentIndex]!;
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === slides.length - 1;

  useEffect(() => {
    let isCurrent = true;

    void window.afterthought.groq.getStatus().then((status) => {
      if (!isCurrent) {
        return;
      }

      setGroqStatus(status);
      if (status.configured) {
        void window.afterthought.groq.validateApiKey().then((validatedStatus) => {
          if (isCurrent) {
            setGroqStatus(validatedStatus);
          }
        });
      }
    });

    return () => {
      isCurrent = false;
    };
  }, []);

  const finish = (): void => {
    if (groqStatus?.valid === true) {
      void completeOnboarding();
      return;
    }

    if (!groqApiKey.trim()) {
      setGroqAction('error');
      setGroqMessage('A valid Groq API key is required to continue.');
      return;
    }

    setGroqAction('saving');
    setGroqMessage('');
    void window.afterthought.groq
      .setApiKey(groqApiKey)
      .then((status) => {
        if (status.valid !== true) {
          throw new Error('Groq could not verify this key.');
        }

        setGroqStatus(status);
        setGroqApiKey('');
        return completeOnboarding();
      })
      .catch((error: unknown) => {
        setGroqAction('error');
        setGroqMessage(
          error instanceof Error
            ? error.message
            : 'The Groq key could not be verified.',
        );
      });
  };

  const completeOnboarding = async (): Promise<void> => {
    await window.afterthought.preferences.set({
      onboardingCompletedAt: new Date().toISOString(),
    });
    void navigate('/calendar');
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-6 sm:px-10 sm:py-8 lg:px-14">
        <header className="flex items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-card text-primary">
              <Feather className="h-6 w-6" aria-hidden="true" />
            </div>
            <span className="font-sans text-2xl font-semibold tracking-tight">
              Afterthought
            </span>
          </div>
        </header>

        <div className="flex flex-1 items-center py-10 sm:py-14">
          <div className="grid w-full items-center gap-12 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:gap-20">
            <section
              key={slide.title}
              className="route-content-enter max-w-xl"
              aria-live="polite"
            >
              <div
                className="mb-8 flex items-center gap-2"
                aria-label="Onboarding progress"
              >
                {slides.map((item, index) => (
                  <button
                    key={item.title}
                    type="button"
                    aria-label={`Go to slide ${index + 1}: ${item.title}`}
                    aria-current={index === currentIndex ? 'step' : undefined}
                    onClick={() => setCurrentIndex(index)}
                    className={cn(
                      'h-1.5 rounded-full bg-border transition-[width,background-color] duration-200 ease-out-quart focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                      index === currentIndex
                        ? 'w-10 bg-primary'
                        : 'w-5 hover:bg-primary/60',
                    )}
                  />
                ))}
                <span className="ml-2 text-xs text-muted-foreground">
                  {currentIndex + 1} of {slides.length}
                </span>
              </div>

              <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">
                {slide.eyebrow}
              </p>
              <h1 className="mt-4 max-w-lg text-4xl font-medium leading-[1.08] tracking-tight sm:text-5xl">
                {slide.title}
              </h1>
              <p className="mt-6 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                {slide.description}
              </p>

              {isLast ? (
                <div className="mt-8 max-w-md space-y-3 rounded-xl border border-border/80 bg-card/60 p-4">
                  <div className="flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-primary" aria-hidden="true" />
                    <Label htmlFor="onboarding-groq-api-key">Groq API key</Label>
                  </div>
                  <Input
                    id="onboarding-groq-api-key"
                    type="password"
                    autoComplete="off"
                    value={groqApiKey}
                    disabled={groqAction === 'saving'}
                    onChange={(event) => {
                      setGroqApiKey(event.target.value);
                      setGroqStatus((status) => {
                        if (!status) {
                          return status;
                        }

                        const statusWithoutMessage = { ...status };
                        delete statusWithoutMessage.message;
                        return { ...statusWithoutMessage, valid: false };
                      });
                      setGroqAction('idle');
                      setGroqMessage('');
                    }}
                    placeholder={groqStatus?.maskedKey ?? 'Paste your key'}
                    spellCheck={false}
                  />
                  <p className="text-xs text-muted-foreground">
                    Encrypted locally. Only the last two characters are shown.
                  </p>
                  {groqStatus?.valid === true ? (
                    <p
                      className="text-xs text-emerald-700 dark:text-emerald-400"
                      role="status"
                    >
                      Groq key verified.
                    </p>
                  ) : null}
                  {groqStatus?.message || groqMessage ? (
                    <p className="text-xs text-destructive" role="status">
                      {groqMessage || groqStatus?.message}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-10 flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="group gap-0 transition-[color,background-color,border-color,transform,opacity,gap] hover:gap-2 disabled:hover:gap-0"
                  onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
                  disabled={isFirst}
                  aria-label="Previous slide"
                >
                  <ArrowLeft
                    className="h-4 w-0 translate-x-1 overflow-hidden opacity-0 transition-[width,opacity,transform] duration-150 ease-out-quart group-hover:w-4 group-hover:translate-x-0 group-hover:opacity-100 group-disabled:w-0 group-disabled:opacity-0"
                    aria-hidden="true"
                  />
                  Back
                </Button>
                <Button
                  type="button"
                  className="group gap-0 transition-[color,background-color,border-color,transform,opacity,gap] hover:gap-2"
                  onClick={() => {
                    if (isLast) {
                      finish();
                    } else {
                      setCurrentIndex((index) =>
                        Math.min(slides.length - 1, index + 1),
                      );
                    }
                  }}
                  disabled={
                    isLast &&
                    (groqAction === 'saving' ||
                      (groqStatus?.valid !== true && !groqApiKey.trim()))
                  }
                >
                  {isLast ? 'Open Calendar' : 'Continue'}
                  {isLast ? (
                    <CalendarDays
                      className="h-4 w-0 -translate-x-1 overflow-hidden opacity-0 transition-[width,opacity,transform] duration-150 ease-out-quart group-hover:w-4 group-hover:translate-x-0 group-hover:opacity-100"
                      aria-hidden="true"
                    />
                  ) : (
                    <ArrowRight
                      className="h-4 w-0 -translate-x-1 overflow-hidden opacity-0 transition-[width,opacity,transform] duration-150 ease-out-quart group-hover:w-4 group-hover:translate-x-0 group-hover:opacity-100"
                      aria-hidden="true"
                    />
                  )}
                </Button>
              </div>
            </section>

            <FeaturePreview kind={slide.preview} />
          </div>
        </div>
      </div>
    </main>
  );
}

function FeaturePreview({ kind }: { kind: PreviewKind }) {
  const active =
    kind === 'write'
      ? 'New Entry'
      : kind === 'reflect'
        ? 'Reflections'
        : kind === 'profile'
          ? 'You'
          : 'Calendar';

  return (
    <div
      className="relative min-h-[22rem] overflow-hidden rounded-2xl border border-border/80 bg-card/70 p-3 shadow-[0_20px_64px_hsl(var(--primary)/0.045)] sm:min-h-[30rem] sm:p-5"
      aria-label="Afterthought app preview"
    >
      <div className="flex min-h-[20rem] overflow-hidden rounded-xl border border-border/80 bg-background shadow-[0_10px_32px_hsl(var(--primary)/0.035)] sm:min-h-[27rem]">
        <PreviewSidebar active={active} />
        <div className="min-w-0 flex-1 p-5 sm:p-8">
          {kind === 'welcome' ? <WelcomePreview /> : null}
          {kind === 'write' ? <WritePreview /> : null}
          {kind === 'reflect' ? <ReflectPreview /> : null}
          {kind === 'profile' ? <ProfilePreview /> : null}
          {kind === 'calendar' ? <CalendarPreview /> : null}
        </div>
      </div>
    </div>
  );
}

function PreviewSidebar({ active }: { active: string }) {
  const items = [
    ['Calendar', CalendarDays],
    ['Reflections', Feather],
    ['You', UserRound],
    ['Settings', Settings],
  ] as const;

  return (
    <aside className="hidden w-40 shrink-0 border-r border-border/70 bg-card/55 p-3 sm:block">
      <div className="flex items-center gap-2 px-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-primary">
          <Feather className="h-4 w-4" aria-hidden="true" />
        </div>
        <span className="truncate font-sans text-sm font-semibold">Afterthought</span>
      </div>
      <div className="mt-6 rounded-md bg-primary px-2.5 py-2 text-[0.68rem] font-medium text-primary-foreground">
        <Plus className="mr-1.5 inline h-3 w-3" aria-hidden="true" />
        New Entry
      </div>
      <nav className="mt-4 space-y-1" aria-label="Preview navigation">
        {items.map(([label, Icon]) => (
          <div
            key={label}
            className={cn(
              'flex items-center gap-2 rounded-md px-2.5 py-2 text-[0.68rem] text-muted-foreground',
              label === active && 'bg-secondary text-foreground',
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {label}
          </div>
        ))}
      </nav>
    </aside>
  );
}

function WelcomePreview() {
  return (
    <div className="flex h-full min-h-[19rem] flex-col">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-medium sm:text-3xl">July 2026</h2>
          <p className="mt-2 text-xs text-muted-foreground">0 entries this month</p>
        </div>
        <div className="flex gap-1">
          <PreviewIconButton label="Previous month" />
          <PreviewIconButton label="Next month" />
        </div>
      </div>
      <EmptyCalendarGrid />
      <div className="mt-5 border-t border-border/70 pt-5">
        <div className="flex items-start gap-3">
          <Feather className="mt-1 h-7 w-7 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <p className="text-3xl font-medium tracking-tight sm:text-4xl">
              Afterthought
            </p>
            <p className="mt-2 writing-text text-lg text-foreground/80">
              Nothing written here yet.
            </p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Give this month a few honest lines to remember.
            </p>
            <div className="mt-3 inline-flex rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">
              Start writing
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function WritePreview() {
  return (
    <div className="flex h-full min-h-[19rem] flex-col">
      <div className="flex items-start justify-between gap-4">
        <span className="text-xs text-muted-foreground">← Back</span>
        <span className="text-right text-[0.65rem] text-muted-foreground">
          Today · 9:41 AM
        </span>
      </div>
      <div className="mt-7 space-y-3">
        <p className="writing-text text-xl leading-7 text-foreground/90">
          What has been taking up more space in your mind than you expected?
        </p>
        <p className="writing-text text-lg leading-7 text-muted-foreground">
          What are you noticing about the way you want to move through this season?
        </p>
        <p className="text-[0.65rem] text-muted-foreground">Supermemory context</p>
      </div>
      <div className="mt-6 flex flex-1 rounded-lg border border-border bg-card/35 px-4 py-4">
        <span className="writing-text text-sm text-muted-foreground/50">
          Begin wherever your attention is resting.
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
        <span>No words yet</span>
        <span className="rounded-md bg-secondary px-3 py-1.5 text-foreground/40">
          Finish
        </span>
      </div>
    </div>
  );
}

function ReflectPreview() {
  return (
    <div className="min-h-[19rem]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Reflections</p>
          <h2 className="mt-1 text-2xl font-medium">Threads worth noticing</h2>
        </div>
        <div className="rounded-md border border-border px-2 py-1.5 text-[0.65rem] text-muted-foreground">
          <RefreshCw className="mr-1 inline h-3 w-3" aria-hidden="true" />
          Refresh
        </div>
      </div>
      <p className="mt-3 max-w-md text-xs leading-5 text-muted-foreground">
        Supermemory keeps source moments; Groq helps arrange them into grounded threads.
      </p>
      <div className="mt-5 rounded-lg border border-border bg-card/65 p-4">
        <p className="text-sm font-medium">
          Memory index is ready for your first reflection
        </p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Your saved reflections stay on this machine.
        </p>
      </div>
      <div className="mt-5 border-t border-border pt-5">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
          The reflection loop
        </p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Write locally, remember through Supermemory, then use Groq to look again.
        </p>
      </div>
      <p className="mt-5 text-xs text-muted-foreground">
        Nothing has been remembered yet. Finish an entry and it will surface here.
      </p>
    </div>
  );
}

function ProfilePreview() {
  return (
    <div className="min-h-[19rem]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground">You</p>
          <h2 className="mt-1 text-2xl font-medium">A portrait in progress</h2>
        </div>
        <div className="rounded-md border border-border px-2 py-1.5 text-[0.65rem] text-muted-foreground">
          <RefreshCw className="mr-1 inline h-3 w-3" aria-hidden="true" />
          Refresh
        </div>
      </div>
      <p className="mt-3 max-w-md text-xs leading-5 text-muted-foreground">
        A cautious portrait of what may be changing and what may hold steady.
      </p>
      <div className="mt-8 border-t border-border pt-6">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
          What seems to be shifting
        </p>
        <p className="mt-4 writing-text text-lg leading-7 text-muted-foreground/60">
          Nothing is remembered yet.
        </p>
      </div>
      <p className="mt-6 text-xs text-muted-foreground">
        Finish an entry to begin the longer view.
      </p>
    </div>
  );
}

function CalendarPreview() {
  return <WelcomePreview />;
}

function EmptyCalendarGrid() {
  const days = Array.from({ length: 35 }, (_, index) => index + 1);

  return (
    <div className="mt-5 grid grid-cols-7 overflow-hidden rounded-lg border border-border/70 text-center text-[0.55rem]">
      {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day) => (
        <span
          key={day}
          className="border-b border-border/70 px-1 py-2 text-muted-foreground"
        >
          {day}
        </span>
      ))}
      {days.map((day) => (
        <span
          key={day}
          className="flex aspect-square items-start justify-end border-b border-r border-border/60 bg-background p-1 text-muted-foreground"
        >
          {day <= 31 ? day : ''}
        </span>
      ))}
    </div>
  );
}

function PreviewIconButton({ label }: { label: string }) {
  return (
    <span
      aria-label={label}
      className="flex h-6 w-6 items-center justify-center rounded-md border border-border text-xs text-muted-foreground"
    >
      {label === 'Previous month' ? '‹' : '›'}
    </span>
  );
}
