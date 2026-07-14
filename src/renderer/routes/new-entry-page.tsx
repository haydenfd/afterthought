import { format } from 'date-fns';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  LoaderCircle,
  MoveDown,
} from 'lucide-react';
import { type AnimationEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useBeforeUnload, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useDraft } from '@/state/draft-context';
import type {
  MemoryEvidenceItem,
  OpeningQuestions,
  ReflectionProvenance,
} from '../../shared/reflection';

const fallbackQuestions = [
  'What has been taking up more space in your mind than you expected?',
  'What are you noticing about the way you want to move through this season?',
] as const;
const discardMessage = 'Discard this unfinished journal entry?';

export function NewEntryPage() {
  const { draft, setDraft, isFinished, finishEntry, resetDraft } = useDraft();
  const navigate = useNavigate();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const deeperTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const saveInProgress = useRef(false);
  const deeperRequestInProgress = useRef(false);
  const hasRequestedPrompt = useRef(false);
  const bypassPopGuard = useRef(false);
  const hasCompletedClose = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [aiQuestions, setAiQuestions] = useState<[string, string] | null>(null);
  const [openingSourceMemories, setOpeningSourceMemories] = useState<
    MemoryEvidenceItem[]
  >([]);
  const [isOpeningContextExpanded, setIsOpeningContextExpanded] = useState(false);
  const [isDeeperContextExpanded, setIsDeeperContextExpanded] = useState(false);
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(true);
  const [deeperQuestion, setDeeperQuestion] = useState<string | null>(null);
  const [deeperResponse, setDeeperResponse] = useState('');
  const [deeperThemes, setDeeperThemes] = useState<string[]>([]);
  const [deeperProvenance, setDeeperProvenance] = useState<ReflectionProvenance | null>(
    null,
  );
  const [isGeneratingDeeper, setIsGeneratingDeeper] = useState(false);
  const [deeperError, setDeeperError] = useState<string | null>(null);
  const [startedAt] = useState(() => new Date());
  const wordCount = countWords(`${draft} ${deeperResponse}`);
  const questions: OpeningQuestions = aiQuestions ?? [...fallbackQuestions];
  const primaryQuestion = questions[0];
  const hasUnsavedContent = draft.trim().length > 0 || deeperResponse.trim().length > 0;
  const canGoDeeper = countWords(draft) >= 5;

  useEffect(() => {
    if (hasRequestedPrompt.current) {
      return;
    }

    hasRequestedPrompt.current = true;
    let isCurrent = true;

    void window.afterthought.reflection
      .openingQuestions()
      .then((result) => {
        if (isCurrent && result.questions) {
          setAiQuestions(result.questions);
          setOpeningSourceMemories(result.sourceMemories ?? []);
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

  useEffect(() => {
    autosizeTextarea(deeperTextareaRef.current);
  }, [deeperResponse]);

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
    }, 2200);

    return () => window.clearTimeout(timeoutId);
  }, [isFinished, navigate, resetDraft]);

  const completeClose = useCallback(() => {
    if (hasCompletedClose.current) {
      return;
    }

    hasCompletedClose.current = true;
    finishEntry();
  }, [finishEntry]);

  useEffect(() => {
    if (!isClosing) {
      return;
    }

    // Animation events can be skipped if the window is backgrounded mid-close.
    const fallbackId = window.setTimeout(completeClose, 1400);
    return () => window.clearTimeout(fallbackId);
  }, [completeClose, isClosing]);

  const returnToCalendar = useCallback(() => {
    if (!isFinished && hasUnsavedContent && !window.confirm(discardMessage)) {
      return;
    }

    resetDraft();
    void navigate('/calendar');
  }, [hasUnsavedContent, isFinished, navigate, resetDraft]);

  if (isFinished) {
    return (
      <section className="reflection-complete-page mx-auto flex min-h-screen max-w-4xl flex-col px-10 py-12">
        <button
          type="button"
          className="reflection-complete-back inline-flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
          onClick={returnToCalendar}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Return to Calendar
        </button>

        <div
          className="reflection-complete-content my-auto max-w-2xl pb-24"
          role="status"
          aria-live="polite"
        >
          <div className="reflection-complete-mark mb-7 flex h-11 w-11 items-center justify-center rounded-full border border-primary/25 bg-accent/70 text-accent-foreground">
            <Check className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 className="writing-text text-4xl leading-[1.2]">That page is closed.</h2>
          <p className="mt-5 writing-text text-xl leading-8 text-muted-foreground">
            Your reflection has been saved.
          </p>
          <p className="mt-3 text-sm leading-6 text-muted-foreground/75">
            Taking you back to your calendar.
          </p>
          <Button
            className="mt-9"
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
      await window.afterthought.entries.create({
        prompt: primaryQuestion,
        openingQuestions: questions,
        content,
        ...(openingSourceMemories.length > 0
          ? { openingContext: openingSourceMemories }
          : {}),
        ...(deeperQuestion
          ? {
              deeperReflection: {
                question: deeperQuestion,
                ...(deeperResponse.trim() ? { response: deeperResponse.trim() } : {}),
                ...(deeperProvenance ? { provenance: deeperProvenance } : {}),
              },
            }
          : {}),
        ...(deeperThemes.length > 0 ? { themes: deeperThemes } : {}),
      });
      setIsClosing(true);
    } catch {
      setSaveError('Your entry could not be saved. Please try again.');
    } finally {
      saveInProgress.current = false;
      setIsSaving(false);
    }
  }

  async function handleGoDeeper(): Promise<void> {
    if (
      !canGoDeeper ||
      deeperQuestion ||
      isGeneratingDeeper ||
      deeperRequestInProgress.current
    ) {
      return;
    }

    deeperRequestInProgress.current = true;
    setIsGeneratingDeeper(true);
    setDeeperError(null);

    try {
      const result = await window.afterthought.reflection.deeperQuestion({
        openingQuestions: questions,
        initialResponse: draft.trim(),
      });
      setDeeperQuestion(result.question);
      setDeeperThemes(result.themes);
      setDeeperProvenance(result.provenance);
      window.requestAnimationFrame(() => deeperTextareaRef.current?.focus());
    } catch {
      deeperRequestInProgress.current = false;
      setDeeperError(
        'A deeper question is not available right now. You can still finish this reflection.',
      );
    } finally {
      setIsGeneratingDeeper(false);
    }
  }

  function handleCloseAnimationEnd(event: AnimationEvent<HTMLElement>): void {
    const animationTarget = event.target;

    if (
      !isClosing ||
      !(animationTarget instanceof HTMLElement) ||
      !animationTarget.classList.contains('reflection-page')
    ) {
      return;
    }

    completeClose();
  }

  return (
    <section
      className={cn(
        'reflection-page min-h-screen bg-background px-6 py-6 text-foreground sm:px-10 sm:py-10',
        isClosing && 'reflection-page--closing',
      )}
      data-testid="reflection-page"
      aria-busy={isSaving || isClosing}
      onAnimationEnd={handleCloseAnimationEnd}
    >
      <div className="reflection-crumple-creases" aria-hidden="true" />
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col">
        <header className="mb-14 flex items-start justify-between gap-8">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground/80 transition-colors hover:text-foreground"
            aria-label="Back to Calendar"
            onClick={returnToCalendar}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back
          </button>
          <p className="text-right text-[11px] leading-4 text-muted-foreground/65">
            {format(startedAt, 'EEE, MMM d · h:mm a')}
          </p>
        </header>

        <div className="flex flex-1 flex-col">
          {isLoadingPrompt ? (
            <div
              className="flex min-h-[420px] max-w-3xl flex-col justify-center rounded-lg border border-border bg-card/45 px-8 py-10"
              aria-live="polite"
            >
              <LoaderCircle
                className="h-5 w-5 animate-spin text-primary motion-reduce:animate-none"
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
              <div className="mb-10 max-w-4xl space-y-6">
                <h1 className="writing-text text-3xl leading-[1.28]">{questions[0]}</h1>
                <p className="writing-text text-2xl leading-8 text-muted-foreground">
                  {questions[1]}
                </p>
                <MemoryThreadContext
                  label="A thread you may be returning to"
                  memories={openingSourceMemories}
                  expanded={isOpeningContextExpanded}
                  onToggle={() =>
                    setIsOpeningContextExpanded((isExpanded) => !isExpanded)
                  }
                />
              </div>

              <Textarea
                ref={textareaRef}
                value={draft}
                readOnly={isGeneratingDeeper || deeperQuestion !== null}
                onChange={(event) => {
                  setDraft(event.target.value);
                  autosizeTextarea(event.target);
                }}
                placeholder="Begin wherever your attention is resting."
                className={cn(
                  'writing-text min-h-[380px] flex-1 border-0 bg-transparent px-0 py-0 text-[22px] leading-9 shadow-none placeholder:text-muted-foreground/40 focus-visible:ring-0',
                  'selection:bg-accent selection:text-accent-foreground',
                )}
                aria-label="Journal entry"
              />

              {isGeneratingDeeper ? (
                <div className="mt-10 border-t border-border pt-10" aria-live="polite">
                  <LoaderCircle
                    className="h-4 w-4 animate-spin text-primary motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                  <p className="mt-4 text-sm text-muted-foreground">
                    Looking for one useful place to go deeper…
                  </p>
                </div>
              ) : null}

              {deeperQuestion ? (
                <section
                  className="route-content-enter mt-10 border-t border-border pt-10"
                  aria-labelledby="deeper-question"
                >
                  <p className="mb-4 text-sm text-muted-foreground">A little deeper</p>
                  <h2
                    id="deeper-question"
                    className="max-w-4xl writing-text text-2xl leading-9"
                  >
                    {deeperQuestion}
                  </h2>
                  <MemoryThreadContext
                    label="This question is connected to"
                    memories={deeperProvenance?.sourceMemories ?? []}
                    expanded={isDeeperContextExpanded}
                    onToggle={() =>
                      setIsDeeperContextExpanded((isExpanded) => !isExpanded)
                    }
                    className="mt-5"
                  />
                  <Textarea
                    ref={deeperTextareaRef}
                    value={deeperResponse}
                    onChange={(event) => {
                      setDeeperResponse(event.target.value);
                      autosizeTextarea(event.target);
                    }}
                    placeholder="Stay with this for as long as it is useful."
                    className="mt-8 min-h-[220px] border-0 bg-transparent px-0 py-0 writing-text text-[21px] leading-9 shadow-none placeholder:text-muted-foreground/40 focus-visible:ring-0"
                    aria-label="Deeper reflection"
                  />
                </section>
              ) : null}

              <footer className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
                <p className="text-sm text-muted-foreground">
                  {wordCount === 0
                    ? 'No words yet'
                    : `${wordCount} ${wordCount === 1 ? 'word' : 'words'}`}
                </p>
                <div className="flex items-center gap-2">
                  {!deeperQuestion ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={isSaving || isGeneratingDeeper || !canGoDeeper}
                      onClick={() => void handleGoDeeper()}
                    >
                      <MoveDown className="h-4 w-4" aria-hidden="true" />
                      {deeperError ? 'Try going deeper again' : 'Go deeper'}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    disabled={
                      isSaving || isClosing || isGeneratingDeeper || !draft.trim()
                    }
                    onClick={() => void handleFinishEntry()}
                  >
                    {isSaving ? 'Finishing…' : 'Finish'}
                  </Button>
                </div>
              </footer>
              {deeperError ? (
                <p className="mt-3 text-sm text-muted-foreground" role="status">
                  {deeperError}
                </p>
              ) : null}
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

function MemoryThreadContext({
  label,
  memories,
  expanded,
  onToggle,
  className,
}: {
  label: string;
  memories: MemoryEvidenceItem[];
  expanded: boolean;
  onToggle: () => void;
  className?: string;
}) {
  if (memories.length === 0) {
    return null;
  }

  const visibleMemories = expanded ? memories : memories.slice(0, 1);
  const ToggleIcon = expanded ? ChevronDown : ChevronRight;

  return (
    <div
      className={cn(
        'max-w-3xl border-l border-border pl-4 text-sm leading-6 text-muted-foreground',
        className,
      )}
    >
      <p className="font-sans text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground/75">
        {label}
      </p>
      <ul className="mt-2 space-y-2">
        {visibleMemories.map((memory) => (
          <li key={memory.id} className="writing-text text-base leading-7">
            {previewMemory(memory.text)}
          </li>
        ))}
      </ul>
      {memories.length > 1 ? (
        <button
          type="button"
          className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          onClick={onToggle}
        >
          <ToggleIcon className="h-3.5 w-3.5" aria-hidden="true" />
          {expanded ? 'Show less' : `Show ${memories.length - 1} more`}
        </button>
      ) : null}
    </div>
  );
}

function previewMemory(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();

  if (normalized.length <= 180) {
    return normalized;
  }

  return `${normalized.slice(0, 177).trimEnd()}...`;
}
