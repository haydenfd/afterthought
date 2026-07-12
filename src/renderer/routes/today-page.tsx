import { Check, PenLine } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { formatFullDate, formatWeekday } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { useDraft } from '@/state/draft-context';

const fallbackPrompt =
  'What has been taking up more space in your mind than you expected?';

export function TodayPage() {
  const { draft, setDraft, isFinished, finishEntry, returnToEditing } = useDraft();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const saveInProgress = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState<string | null>(null);
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(true);
  const today = new Date();
  const wordCount = countWords(draft);
  const prompt = aiPrompt ?? fallbackPrompt;

  useEffect(() => {
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
  }, [draft, isFinished]);

  if (isFinished) {
    return (
      <section className="mx-auto flex min-h-screen max-w-4xl flex-col px-10 py-12">
        <div className="mb-12">
          <p className="text-sm text-muted-foreground">{formatWeekday(today)}</p>
          <h1 className="mt-1 text-3xl font-medium tracking-normal">
            {formatFullDate(today)}
          </h1>
        </div>

        <div className="max-w-2xl rounded-lg border border-border bg-card px-6 py-6">
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
            You can return to it whenever you&apos;re ready.
          </p>
          <Button
            className="mt-8"
            variant="outline"
            type="button"
            onClick={returnToEditing}
          >
            <PenLine className="h-4 w-4" aria-hidden="true" />
            Return to editing
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
    <section className="mx-auto flex min-h-screen max-w-5xl flex-col px-10 py-10">
      <header className="mb-10 flex items-start justify-between gap-8">
        <div>
          <p className="text-sm text-muted-foreground">{formatWeekday(today)}</p>
          <h1 className="mt-1 text-3xl font-medium tracking-normal">
            {formatFullDate(today)}
          </h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Draft saved for this session
        </p>
      </header>

      <div className="flex flex-1 flex-col">
        <p className="mb-5 max-w-3xl text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Today&apos;s prompt
        </p>
        <h2
          className={cn(
            'mb-8 max-w-4xl writing-text text-4xl leading-[1.22] transition-opacity duration-200',
            isLoadingPrompt && 'opacity-60',
          )}
        >
          {prompt}
        </h2>

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
