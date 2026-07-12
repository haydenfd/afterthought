import { addMonths, format, startOfMonth } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import {
  canNavigateToMonth,
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
  const nextMonth = addMonths(visibleMonth, 1);
  const canGoNext = canNavigateToMonth(nextMonth, today);

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
  }, [location.key]);

  return (
    <section className="mx-auto min-h-screen max-w-5xl px-10 py-10">
      <header className="mb-9 flex items-start justify-between gap-8">
        <div>
          <p className="text-sm text-muted-foreground">Calendar</p>
          <h1 className="mt-1 text-3xl font-medium">
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

      <div className="rounded-lg border border-border bg-card">
        <div className="grid grid-cols-7 border-b border-border text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {weekdayLabels.map((label) => (
            <div key={label} className="px-4 py-3">
              {label}
            </div>
          ))}
        </div>

        {monthlyEntryCount === 0 ? (
          <p className="px-4 pt-4 text-sm text-muted-foreground">
            No entries yet this month.
          </p>
        ) : null}
        {loadError ? (
          <p className="px-4 pt-4 text-sm text-muted-foreground">
            Entries could not be loaded right now.
          </p>
        ) : null}

        <div className="grid grid-cols-7">
          {monthGrid.map((day) => {
            const selectable =
              isSelectableEntryDay(day) || (day.isToday && day.isCurrentMonth);

            return (
              <button
                key={day.date.toISOString()}
                type="button"
                disabled={!selectable}
                onClick={() => {
                  void navigate(`/calendar/${formatRouteDate(day.date)}`);
                }}
                className={cn(
                  'min-h-24 border-b border-r border-border p-3 text-left transition-colors last:border-r-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  !day.isCurrentMonth && 'bg-background/35 text-muted-foreground/45',
                  day.isCurrentMonth && 'bg-card text-foreground',
                  day.isFuture && 'cursor-not-allowed text-muted-foreground/35',
                  selectable && 'cursor-pointer hover:bg-secondary/65',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-md text-sm',
                      day.isToday &&
                        'border border-primary bg-accent text-accent-foreground',
                    )}
                  >
                    {day.dayNumber}
                  </span>
                  {day.hasEntry && !day.isFuture ? (
                    <span className="h-2 w-2 rounded-full bg-primary" />
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
