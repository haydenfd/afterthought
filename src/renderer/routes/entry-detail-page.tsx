import { ArrowLeft } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { formatFullDate, formatRouteDate, parseRouteDate } from '@/lib/dates';
import { groupEntriesByLocalDate } from '@/lib/calendar';
import { cn } from '@/lib/utils';
import type { JournalEntry } from '../../shared/journal-entry';

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
      <Button variant="ghost" asChild>
        <Link to="/calendar">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Calendar
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
            <p className="mt-6 whitespace-pre-wrap writing-text text-xl leading-9 text-foreground">
              {entry.content}
            </p>
            {entry.deeperReflection ? (
              <section className="mt-9 border-l border-border pl-5">
                <p className="text-sm text-muted-foreground">A little deeper</p>
                <p className="mt-3 writing-text text-xl italic leading-8 text-muted-foreground">
                  {entry.deeperReflection.question}
                </p>
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
            <Button type="button" onClick={() => void navigate('/entry/new')}>
              Start writing
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
