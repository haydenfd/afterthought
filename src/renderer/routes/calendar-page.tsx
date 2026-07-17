import { addMonths, format, isSameMonth, startOfMonth } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import {
  canNavigateToMonth,
  canNavigateToMonthFrom,
  countEntriesInMonth,
  createMonthGrid,
  groupEntriesByLocalDate,
  isSelectableEntryDay,
} from '@/lib/calendar';
import { formatRouteDate } from '@/lib/dates';
import { cn } from '@/lib/utils';
import type { JournalEntry } from '../../shared/journal-entry';

const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function CalendarPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const today = useMemo(() => new Date(), []);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(today));
  const [calendarStartMonth, setCalendarStartMonth] = useState(() =>
    startOfMonth(today),
  );
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loadError, setLoadError] = useState(false);
  const entriesByDate = useMemo(() => groupEntriesByLocalDate(entries), [entries]);
  const markedDates = useMemo(() => {
    return [...entriesByDate.keys()].map((date) => new Date(`${date}T00:00:00`));
  }, [entriesByDate]);
  const monthGrid = useMemo(
    () => createMonthGrid(visibleMonth, today, markedDates),
    [visibleMonth, today, markedDates],
  );
  const monthlyEntryCount = useMemo(
    () => countEntriesInMonth(entries, visibleMonth),
    [entries, visibleMonth],
  );
  const monthlyEntries = useMemo(
    () =>
      entries
        .filter((entry) => {
          const date = new Date(entry.createdAt);
          return !Number.isNaN(date.getTime()) && isSameMonth(date, visibleMonth);
        })
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, 5),
    [entries, visibleMonth],
  );
  const previousMonth = addMonths(visibleMonth, -1);
  const nextMonth = addMonths(visibleMonth, 1);
  const canGoPrevious = canNavigateToMonthFrom(previousMonth, calendarStartMonth);
  const canGoNext = canNavigateToMonth(nextMonth, today);
  const isCurrentMonth = isSameMonth(visibleMonth, today);

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

    void window.afterthought.preferences
      .get()
      .then((preferences) => {
        if (!isCurrent || !preferences.installedAt) {
          return;
        }

        const installedAt = new Date(preferences.installedAt);
        if (!Number.isNaN(installedAt.getTime())) {
          setCalendarStartMonth(startOfMonth(installedAt));
        }
      })
      .catch(() => {
        // Keep the current month as the safe lower bound if preferences are unavailable.
      });

    return () => {
      isCurrent = false;
    };
  }, [location.key]);

  return (
    <section className="mx-auto min-h-screen max-w-6xl px-6 py-8 sm:px-10 sm:py-10">
      <header className="mb-8 flex items-start justify-between gap-8">
        <div>
          <h1 className="text-4xl font-medium tracking-tight">
            {format(visibleMonth, 'MMMM yyyy')}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {monthlyEntryCount === 1
              ? '1 entry this month'
              : `${monthlyEntryCount} entries this month`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Previous month"
            disabled={!canGoPrevious}
            onClick={() => setVisibleMonth((month) => addMonths(month, -1))}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Next month"
            disabled={!canGoNext}
            onClick={() => setVisibleMonth((month) => addMonths(month, 1))}
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="overflow-hidden rounded-2xl border border-border/80 bg-card/75 shadow-[0_30px_28px_-32px_hsl(var(--primary)/0.42)]">
          <div className="grid grid-cols-7 border-b border-border/80 bg-background/20 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {weekdayLabels.map((label) => (
              <div key={label} className="px-3 py-3 sm:px-4">
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {monthGrid.map((day, index) => {
              const isLastColumn = index % 7 === 6;
              const isLastRow = index >= monthGrid.length - 7;

              if (!day.isCurrentMonth) {
                return (
                  <div
                    key={day.date.toISOString()}
                    aria-hidden="true"
                    className={cn(
                      'min-h-[4.75rem] bg-background/10 sm:min-h-20',
                      !isLastColumn && 'border-r border-border/60',
                      !isLastRow && 'border-b border-border/60',
                    )}
                  />
                );
              }

              const entryCount =
                entriesByDate.get(formatRouteDate(day.date))?.length ?? 0;
              const hasEntry = day.hasEntry && !day.isFuture;
              const selectable =
                isSelectableEntryDay(day) || (day.isToday && day.isCurrentMonth);
              const entryLabel = entryCount === 1 ? '1 entry' : `${entryCount} entries`;

              return (
                <button
                  key={day.date.toISOString()}
                  type="button"
                  disabled={!selectable}
                  aria-label={`${format(day.date, 'MMMM d, yyyy')}${day.isToday ? ', today' : ''}${hasEntry ? `, ${entryLabel}` : ''}`}
                  aria-current={day.isToday ? 'date' : undefined}
                  onClick={() => {
                    void navigate(`/calendar/${formatRouteDate(day.date)}`);
                  }}
                  className={cn(
                    'relative flex min-h-[4.75rem] flex-col justify-between p-2.5 text-left text-foreground/75 transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:min-h-20 sm:p-3',
                    !isLastColumn && 'border-r border-border/60',
                    !isLastRow && 'border-b border-border/60',
                    day.isFuture && 'cursor-not-allowed text-foreground/20',
                    hasEntry && 'bg-accent/55 text-foreground',
                    hasEntry &&
                      !isLastColumn &&
                      'border-r-[hsl(var(--foreground)/0.14)]',
                    hasEntry && !isLastRow && 'border-b-[hsl(var(--foreground)/0.14)]',
                    hasEntry && selectable && 'hover:bg-accent/75',
                    selectable && !hasEntry && 'cursor-pointer hover:bg-secondary/55',
                    day.isToday && 'ring-2 ring-inset ring-primary/80',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={cn(
                        'flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-sm',
                        day.isToday && 'font-semibold text-foreground',
                      )}
                    >
                      {day.dayNumber}
                    </span>
                    {entryCount > 1 && !day.isFuture ? (
                      <span
                        role="status"
                        aria-label={entryLabel}
                        className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/15 px-1.5 text-[0.68rem] font-semibold text-primary"
                      >
                        {entryCount}
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <aside
          className="min-w-0 lg:border-l lg:border-border/70 lg:pl-6"
          aria-label="Recent journal entries"
        >
          {loadError ? (
            <p role="alert" className="mt-5 text-sm leading-6 text-muted-foreground">
              Entries could not be loaded right now.
            </p>
          ) : monthlyEntries.length > 0 ? (
            <div key={format(visibleMonth, 'yyyy-MM')} className="calendar-feed-enter">
              {monthlyEntries.map((entry) => (
                <Link
                  key={entry.id}
                  to={`/calendar/${formatRouteDate(new Date(entry.createdAt))}`}
                  className="group block border-b border-border/60 py-4 first:pt-3 last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
                >
                  <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground transition-colors group-hover:text-foreground">
                    {format(new Date(entry.createdAt), 'EEEE, MMMM d')} ·{' '}
                    {format(new Date(entry.createdAt), 'h:mm a')}
                  </p>
                  <p className="mt-2 line-clamp-3 writing-text text-lg leading-7 text-foreground/85">
                    {previewContent(entry.content)}
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-8 max-w-xs">
              <p className="writing-text text-xl leading-8 text-foreground/80">
                {isCurrentMonth
                  ? 'Nothing written here yet.'
                  : 'Nothing written this month.'}
              </p>
              {isCurrentMonth ? (
                <>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Give this month a few honest lines to remember.
                  </p>
                  <Button asChild className="mt-5">
                    <Link to="/entry/new">Start writing</Link>
                  </Button>
                </>
              ) : null}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function previewContent(content: string): string {
  const preview = content.replace(/\s+/g, ' ').trim();

  if (preview.length <= 140) {
    return preview;
  }

  return `${preview.slice(0, 137).trimEnd()}…`;
}
