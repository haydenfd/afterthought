import { ArrowLeft, Pencil } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { formatFullDate, formatRouteDate, parseRouteDate } from '@/lib/dates';
import { groupEntriesByLocalDate } from '@/lib/calendar';
import { cn } from '@/lib/utils';
import type { JournalEntry } from '../../shared/journal-entry';
import type { MemoryEvidenceItem } from '../../shared/reflection';

export function EntryDetailPage() {
  const { date } = useParams();
  const navigate = useNavigate();
  const parsedDate = parseRouteDate(date);
  const isToday = parsedDate ? isSameDay(parsedDate, new Date()) : false;
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loadError, setLoadError] = useState(false);
  const entriesForDate = useMemo(() => {
    if (!parsedDate) {
      return [];
    }

    return (
      groupEntriesByLocalDate(entries).get(formatRouteDate(parsedDate)) ?? []
    ).sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }, [entries, parsedDate]);
  const entriesById = useMemo(
    () => new Map(entries.map((entry) => [entry.id, entry])),
    [entries],
  );

  useEffect(() => {
    let isCurrent = true;

    void window.afterthought.entries
      .list()
      .then((loadedEntries) => {
        if (isCurrent) {
          setEntries(loadedEntries);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setLoadError(true);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  return (
    <section className="mx-auto min-h-screen max-w-4xl px-10 py-10">
      <Button
        variant="outline"
        asChild
        className="group gap-0 transition-[color,background-color,border-color,transform,opacity,gap] hover:gap-2"
      >
        <Link to="/calendar">
          <ArrowLeft
            className="h-4 w-0 -translate-x-1 overflow-hidden opacity-0 transition-[width,opacity,transform] duration-150 ease-out-quart group-hover:w-4 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:w-4 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
            aria-hidden="true"
          />
          Back
        </Link>
      </Button>

      <header className="mt-8">
        <h1 className="text-3xl font-medium">
          {parsedDate ? formatFullDate(parsedDate) : 'Unknown date'}
        </h1>
      </header>

      <div className="mt-8">
        {entriesForDate.map((entry, index) => (
          <article
            key={entry.id}
            className={cn(
              'entry-detail-entry-enter',
              index > 0 && 'mt-10 border-t border-border pt-10',
            )}
          >
            <p className="text-sm text-muted-foreground">
              {format(new Date(entry.createdAt), 'h:mm a')}
            </p>
            <div className="mt-4 space-y-2">
              {(entry.openingQuestions ?? (entry.prompt ? [entry.prompt] : [])).map(
                (question) => (
                  <p
                    key={question}
                    className="writing-text text-xl italic leading-8 text-muted-foreground"
                  >
                    {question}
                  </p>
                ),
              )}
            </div>
            <MemoryEvidenceContext
              label="Why this prompt appeared"
              memories={entry.openingContext ?? []}
              entriesById={entriesById}
              currentEntryId={entry.id}
              className="mt-5"
            />
            <p className="mt-6 whitespace-pre-wrap writing-text text-xl leading-9 text-foreground">
              {entry.content}
            </p>
            {entry.deeperReflection ? (
              <section className="mt-9 border-l border-border pl-5">
                <p className="text-sm text-muted-foreground">A little deeper</p>
                <p className="mt-3 writing-text text-xl italic leading-8 text-muted-foreground">
                  {entry.deeperReflection.question}
                </p>
                <MemoryEvidenceContext
                  label="What this question drew from"
                  memories={entry.deeperReflection.provenance?.sourceMemories ?? []}
                  entriesById={entriesById}
                  currentEntryId={entry.id}
                  className="mt-4"
                />
                {entry.deeperReflection.response ? (
                  <p className="mt-5 whitespace-pre-wrap writing-text text-xl leading-9 text-foreground">
                    {entry.deeperReflection.response}
                  </p>
                ) : null}
              </section>
            ) : null}
            {entry.themes?.length ? (
              <p className="mt-8 text-xs text-muted-foreground">
                Touched on: {entry.themes.map(formatTheme).join(' · ')}
              </p>
            ) : null}
          </article>
        ))}
        {entriesForDate.length === 0 && !loadError ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {isToday ? 'No entries yet today.' : 'No entries on this day.'}
            </p>
            <Button
              type="button"
              className="group gap-0 transition-[color,background-color,border-color,transform,opacity,gap] hover:gap-2"
              onClick={() => void navigate('/entry/new')}
            >
              Start writing
              <Pencil
                className="h-4 w-0 translate-x-1 overflow-hidden opacity-0 transition-[width,opacity,transform] duration-150 ease-out-quart group-hover:w-4 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:w-4 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
                aria-hidden="true"
              />
            </Button>
          </div>
        ) : null}
        {loadError ? (
          <p className="text-sm text-muted-foreground">
            Entries could not be loaded right now.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function formatTheme(theme: string): string {
  return theme.charAt(0).toLocaleUpperCase() + theme.slice(1);
}

function MemoryEvidenceContext({
  label,
  memories,
  entriesById,
  currentEntryId,
  className,
}: {
  label: string;
  memories: MemoryEvidenceItem[];
  entriesById: Map<string, JournalEntry>;
  currentEntryId: string;
  className?: string;
}) {
  if (memories.length === 0) {
    return null;
  }

  return (
    <section
      className={cn(
        'max-w-3xl border-l border-border pl-4 text-sm leading-6 text-muted-foreground',
        className,
      )}
      aria-label={label}
    >
      <p className="font-sans text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground/75">
        {label}
      </p>
      <ul className="mt-2 space-y-3">
        {memories.map((memory) => {
          const sourceEntry = firstResolvedEntry(
            memory.sourceEntryIds,
            entriesById,
            currentEntryId,
          );

          return (
            <li key={memory.id}>
              <p className="writing-text text-base leading-7">
                {previewMemory(memory.text)}
              </p>
              {sourceEntry ? (
                <Link
                  to={`/calendar/${formatRouteDate(new Date(sourceEntry.createdAt))}`}
                  className="mt-1 inline-flex text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                >
                  View source entry
                </Link>
              ) : memory.sourceDate ? (
                <span className="mt-1 block text-xs text-muted-foreground/75">
                  {formatSourceDate(memory.sourceDate)}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function firstResolvedEntry(
  sourceEntryIds: string[],
  entriesById: Map<string, JournalEntry>,
  currentEntryId: string,
): JournalEntry | null {
  for (const entryId of sourceEntryIds) {
    const entry = entriesById.get(entryId);
    if (entry && entry.id !== currentEntryId) {
      return entry;
    }
  }

  return null;
}

function previewMemory(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();

  if (normalized.length <= 220) {
    return normalized;
  }

  return `${normalized.slice(0, 217).trimEnd()}...`;
}

function formatSourceDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : formatFullDate(parsed);
}
