import { format } from 'date-fns';
import { ArrowLeft, Check, LoaderCircle } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useBeforeUnload, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useDraft } from '@/state/draft-context';

const fallbackPrompt =
  'What has been taking up more space in your mind than you expected?';
const discardMessage = 'Discard this unfinished journal entry?';

export function NewEntryPage() {
  const { draft, setDraft, isFinished, finishEntry, resetDraft } = useDraft();
  const navigate = useNavigate();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const saveInProgress = useRef(false);
  const hasRequestedPrompt = useRef(false);
  const bypassPopGuard = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState<string | null>(null);
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(true);
  const [startedAt] = useState(() => new Date());
  const wordCount = countWords(draft);
  const prompt = aiPrompt ?? fallbackPrompt;
  const hasUnsavedContent = draft.trim().length > 0;

  useEffect(() => {
    if (hasRequestedPrompt.current) {
      return;
    }

    hasRequestedPrompt.current = true;
    let isCurrent = true;

    void window.afterthought.reflection
      .openingQuestions()
      .then((result) => {
        if (isCurrent && result.primaryQuestion) {
          setAiPrompt(result.primaryQuestion);
        }
      })
      .catch(() => {
        // Fall back to the static prompt below; nothing to set here.
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoadingPrompt(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    autosizeTextarea(textareaRef.current);
  }, [draft]);

  useBeforeUnload(
    useCallback(
      (event) => {
        if (!hasUnsavedContent || isFinished) {
          return;
        }

        event.preventDefault();
        event.returnValue = '';
      },
      [hasUnsavedContent, isFinished],
    ),
  );

  useEffect(() => {
    const handlePopState = (): void => {
      if (bypassPopGuard.current) {
        bypassPopGuard.current = false;
        return;
      }

      if (!hasUnsavedContent || isFinished || window.confirm(discardMessage)) {
        return;
      }

      bypassPopGuard.current = true;
      window.history.go(1);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [hasUnsavedContent, isFinished]);

  useEffect(() => {
    if (!isFinished) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      resetDraft();
      void navigate('/calendar', { replace: true, state: { entrySaved: true } });
    }, 900);

    return () => window.clearTimeout(timeoutId);
  }, [isFinished, navigate, resetDraft]);

  const returnToCalendar = useCallback(() => {
    if (!isFinished && hasUnsavedContent && !window.confirm(discardMessage)) {
      return;
    }

    resetDraft();
    void navigate('/calendar');
  }, [hasUnsavedContent, isFinished, navigate, resetDraft]);

  if (isFinished) {
    return (
      <section className="mx-auto flex min-h-screen max-w-4xl flex-col px-10 py-12">
        <button
          type="button"
          className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          onClick={returnToCalendar}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Return to Calendar
        </button>

        <div className="mt-20 max-w-2xl rounded-lg border border-border bg-card px-6 py-6">
          <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
            <Check className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            Entry complete for now
          </p>
          <h2 className="mt-4 writing-text text-3xl leading-[1.25]">
            Your entry has been saved.
          </h2>
          <p className="mt-5 text-sm leading-6 text-muted-foreground">
            Returning you to Calendar now.
          </p>
          <Button
            className="mt-8"
            variant="outline"
            type="button"
            onClick={returnToCalendar}
          >
            Return to Calendar
          </Button>
        </div>
      </section>
    );
  }

  async function handleFinishEntry(): Promise<void> {
    const content = draft.trim();

    if (!content || saveInProgress.current) {
      return;
    }

    saveInProgress.current = true;
    setIsSaving(true);
    setSaveError(null);

    try {
      await window.afterthought.entries.create({ prompt, content });
      finishEntry();
    } catch {
      setSaveError('Your entry could not be saved. Please try again.');
    } finally {
      saveInProgress.current = false;
      setIsSaving(false);
    }
  }

  return (
    <section className="min-h-screen bg-background px-6 py-6 text-foreground sm:px-10 sm:py-10">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col">
        <header className="mb-14 flex items-start justify-between gap-8">
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
            onClick={returnToCalendar}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Calendar
          </button>
          <p className="text-right text-xs leading-5 text-muted-foreground">
            New entry
            <br />
            {format(startedAt, 'EEEE, MMMM d · h:mm a')}
          </p>
        </header>

        <div className="flex flex-1 flex-col">
          {isLoadingPrompt ? (
            <div
              className="flex min-h-[420px] max-w-3xl flex-col justify-center rounded-lg border border-border bg-card/45 px-8 py-10"
              aria-live="polite"
            >
              <LoaderCircle
                className="h-5 w-5 animate-spin text-primary"
                aria-hidden="true"
              />
              <p className="mt-6 text-sm font-medium text-muted-foreground">
                Preparing a quiet place to begin
              </p>
              <p className="mt-2 writing-text text-2xl leading-8 text-foreground/80">
                Looking for the thread you may want to return to.
              </p>
            </div>
          ) : (
            <>
              <p className="mb-5 max-w-3xl text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Today&apos;s prompt
              </p>
              <h1 className="mb-8 max-w-4xl writing-text text-4xl leading-[1.22]">
                {prompt}
              </h1>

              <Textarea
                ref={textareaRef}
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  autosizeTextarea(event.target);
                }}
                placeholder="Start with the thought that keeps returning."
                className={cn(
                  'writing-text min-h-[380px] flex-1 border-0 bg-transparent px-0 py-0 text-[22px] leading-9 shadow-none placeholder:text-muted-foreground/55 focus-visible:ring-0',
                  'selection:bg-accent selection:text-accent-foreground',
                )}
                aria-label="Journal entry"
              />

              <footer className="mt-8 flex items-center justify-between gap-4 border-t border-border pt-5">
                <p className="text-sm text-muted-foreground">
                  {wordCount === 0
                    ? 'No words yet'
                    : `${wordCount} ${wordCount === 1 ? 'word' : 'words'}`}
                </p>
                <Button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void handleFinishEntry()}
                >
                  {isSaving ? 'Saving entry…' : 'Finish entry'}
                </Button>
              </footer>
              {saveError ? (
                <p className="mt-3 text-sm text-muted-foreground" role="alert">
                  {saveError}
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function countWords(value: string): number {
  const words = value.trim().match(/\S+/g);
  return words?.length ?? 0;
}

function autosizeTextarea(element: HTMLTextAreaElement | null): void {
  if (!element) {
    return;
  }

  element.style.height = 'auto';
  element.style.height = `${element.scrollHeight}px`;
}
