import { ArrowLeft } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { formatFullDate, formatRouteDate, parseRouteDate } from '@/lib/dates';
import { groupEntriesByLocalDate } from '@/lib/calendar';
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
            className={index > 0 ? 'mt-10 border-t border-border pt-10' : undefined}
          >
            <p className="text-sm text-muted-foreground">
              {format(new Date(entry.createdAt), 'h:mm a')}
            </p>
            <p className="mt-4 writing-text text-xl italic leading-8 text-muted-foreground">
              {entry.prompt}
            </p>
            <p className="mt-6 whitespace-pre-wrap writing-text text-xl leading-9 text-foreground">
              {entry.content}
            </p>
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
