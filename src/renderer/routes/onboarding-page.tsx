import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Feather,
  KeyRound,
  PanelLeft,
  Sparkles,
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
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-primary">
              <Feather className="h-4 w-4" aria-hidden="true" />
            </div>
            <span className="font-sans text-base font-semibold">Afterthought</span>
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
                  {isLast
                    ? groqAction === 'saving'
                      ? 'Verifying…'
                      : 'Verify key and open Calendar'
                    : 'Continue'}
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
  return (
    <div
      className="relative min-h-[22rem] overflow-hidden rounded-2xl border border-border/80 bg-card/70 p-3 shadow-[0_20px_64px_hsl(var(--primary)/0.045)] sm:min-h-[30rem] sm:p-5"
      aria-label="Afterthought app preview"
    >
      <div className="flex h-full min-h-[20rem] flex-col overflow-hidden rounded-xl border border-border/80 bg-background shadow-[0_10px_32px_hsl(var(--primary)/0.035)] sm:min-h-[27rem]">
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border/70 px-4">
          <span className="h-2 w-2 rounded-full bg-primary/30" />
          <span className="h-2 w-2 rounded-full bg-primary/20" />
          <span className="h-2 w-2 rounded-full bg-primary/10" />
          <span className="ml-2 text-[0.65rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Afterthought
          </span>
        </div>
        <div className="flex min-h-0 flex-1">
          <div className="hidden w-36 shrink-0 border-r border-border/70 bg-card/45 p-3 sm:block">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Feather className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
              Afterthought
            </div>
            <div className="mt-8 space-y-2 text-[0.65rem] text-muted-foreground">
              <div className="flex items-center gap-2 rounded-md bg-secondary px-2 py-1.5 text-foreground">
                <CalendarDays className="h-3 w-3" aria-hidden="true" />
                Calendar
              </div>
              <div className="flex items-center gap-2 px-2 py-1.5">
                <Feather className="h-3 w-3" aria-hidden="true" />
                Reflections
              </div>
              <div className="flex items-center gap-2 px-2 py-1.5">
                <UserRound className="h-3 w-3" aria-hidden="true" />
                You
              </div>
            </div>
          </div>
          <div className="min-w-0 flex-1 p-5 sm:p-8">
            {kind === 'welcome' ? <WelcomePreview /> : null}
            {kind === 'write' ? <WritePreview /> : null}
            {kind === 'reflect' ? <ReflectPreview /> : null}
            {kind === 'profile' ? <ProfilePreview /> : null}
            {kind === 'calendar' ? <CalendarPreview /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function WelcomePreview() {
  return (
    <div className="flex h-full flex-col justify-between gap-8">
      <div>
        <div className="flex items-center gap-2 text-[0.65rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          <PanelLeft className="h-3.5 w-3.5" aria-hidden="true" />A private place to
          write
        </div>
        <h2 className="mt-6 max-w-sm text-3xl font-medium leading-tight sm:text-4xl">
          What has been taking up more space in your mind than you expected?
        </h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <PreviewCard label="Write" icon={<Feather className="h-4 w-4" />} />
        <PreviewCard label="Reflect" icon={<Sparkles className="h-4 w-4" />} />
      </div>
    </div>
  );
}

function WritePreview() {
  return (
    <div className="flex h-full flex-col">
      <p className="text-[0.65rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        New entry
      </p>
      <div className="mt-5 flex flex-1 flex-col rounded-xl border border-border/80 bg-card/55 p-5 sm:p-7">
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-muted-foreground">Today</span>
          <span className="h-2 w-2 rounded-full bg-primary/60" />
        </div>
        <p className="writing-text mt-8 text-xl leading-8 text-foreground/90 sm:text-2xl">
          I keep returning to the same question, but maybe that is the point.
        </p>
        <div className="mt-auto border-t border-border/70 pt-5 text-xs text-muted-foreground">
          Your entry is saved locally when you finish.
        </div>
      </div>
    </div>
  );
}

function ReflectPreview() {
  return (
    <div>
      <p className="text-[0.65rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Reflections
      </p>
      <div className="mt-5 grid grid-cols-7 overflow-hidden rounded-lg border border-border/70 text-center text-[0.62rem]">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
          <span
            key={`${day}-${index}`}
            className="border-b border-border/70 px-1 py-2 text-muted-foreground"
          >
            {day}
          </span>
        ))}
        {Array.from({ length: 21 }, (_, index) => (
          <span
            key={index}
            className={cn(
              'flex aspect-square items-center justify-center border-b border-r border-border/60 text-muted-foreground',
              [3, 8, 12, 17].includes(index) && 'bg-accent/55 text-foreground',
            )}
          >
            {index + 1}
          </span>
        ))}
      </div>
      <div className="mt-5 space-y-3">
        <ReflectionLine text="The thing I thought I had settled keeps asking for attention." />
        <ReflectionLine text="A small shift is still a shift." />
      </div>
    </div>
  );
}

function ProfilePreview() {
  return (
    <div className="flex h-full flex-col">
      <p className="text-[0.65rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        You
      </p>
      <h2 className="mt-5 max-w-md text-2xl font-medium leading-tight sm:text-3xl">
        A portrait in progress
      </h2>
      <div className="mt-8 space-y-6">
        <ProfileLine label="What seems to be shifting" width="76%" />
        <ProfileLine label="What holds steady" width="58%" />
        <ProfileLine label="Threads worth noticing" width="68%" />
      </div>
      <div className="mt-auto flex items-center gap-2 pt-8 text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        Built slowly from what you choose to share
      </div>
    </div>
  );
}

function CalendarPreview() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[0.65rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Calendar
          </p>
          <h2 className="mt-3 text-2xl font-medium sm:text-3xl">July 2026</h2>
        </div>
        <CalendarDays className="h-5 w-5 text-primary" aria-hidden="true" />
      </div>
      <div className="mt-7 grid flex-1 grid-cols-7 gap-px overflow-hidden rounded-lg border border-border/70 bg-border/70">
        {Array.from({ length: 35 }, (_, index) => (
          <span
            key={index}
            className={cn(
              'flex min-h-9 items-start justify-end bg-background p-1.5 text-[0.6rem] text-muted-foreground sm:min-h-11',
              [7, 14, 21, 28].includes(index) && 'bg-accent/55 text-foreground',
            )}
          >
            {index + 1 <= 31 ? index + 1 : ''}
          </span>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
        <Check className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        Your first reflection can start today.
      </div>
    </div>
  );
}

function PreviewCard({ label, icon }: { label: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-background/60 p-3 text-sm">
      <span className="text-primary">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

function ReflectionLine({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-card/55 px-4 py-3">
      <p className="writing-text text-sm leading-6 text-foreground/85">{text}</p>
    </div>
  );
}

function ProfileLine({ label, width }: { label: string; width: string }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-4 text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary/55" style={{ width }} />
      </div>
    </div>
  );
}
