import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { formatFullDate, formatRouteDate } from '@/lib/dates';
import { cn } from '@/lib/utils';
import { formatTheme } from '../../../shared/format-theme';
import type { JournalEntry } from '../../../shared/journal-entry';

const dayInMilliseconds = 24 * 60 * 60 * 1000;
const coldAfterDays = 30;
const recentWithinDays = 14;
const returningGapDays = 14;

export type PresenceTier = 'recurring' | 'returning' | 'emerging';

export type ThemeTouch = {
  entryId: string;
  createdAt: string;
};

export type ThemeAggregate = {
  key: string;
  label: string;
  entries: ThemeTouch[];
  firstTouched: Date;
  lastTouched: Date;
  recurrenceCount: number;
};

export type RecurringTheme = ThemeAggregate & {
  presence: PresenceTier;
};

const presenceLabels: Record<PresenceTier, string> = {
  recurring: 'recurring lately',
  returning: 'back again',
  emerging: 'just came up',
};

export function RecurringThemes({
  entries,
  now,
}: {
  entries: JournalEntry[];
  now?: Date;
}) {
  const referenceDate = useMemo(() => now ?? new Date(), [now]);
  const themes = useMemo(
    () => aggregateThemes(entries, referenceDate),
    [entries, referenceDate],
  );

  if (themes.length === 0) {
    return null;
  }

  return (
    <section aria-labelledby="recurring-themes-heading">
      <div className="mb-4">
        <h2 id="recurring-themes-heading" className="text-xl font-medium">
          Recurring themes
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The themes you keep returning to, and how present they feel lately.
        </p>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-4">
        {themes.map((theme) => (
          <ThemeLink key={theme.key} theme={theme} />
        ))}
      </div>
    </section>
  );
}

function ThemeLink({ theme }: { theme: RecurringTheme }) {
  const mostRecentEntry = theme.entries[theme.entries.length - 1];
  if (!mostRecentEntry) {
    return null;
  }

  const mostRecentDate = new Date(mostRecentEntry.createdAt);
  if (Number.isNaN(mostRecentDate.getTime())) {
    return null;
  }

  return (
    <Link
      to={`/calendar/${formatRouteDate(mostRecentDate)}`}
      className={cn(
        'group inline-flex flex-col gap-0.5 rounded-md border border-transparent px-1.5 py-1 transition-colors hover:border-border hover:bg-card/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        theme.presence === 'recurring' && 'text-lg text-foreground',
        theme.presence === 'returning' && 'text-base text-foreground/85',
        theme.presence === 'emerging' && 'text-sm text-muted-foreground',
      )}
      aria-label={`${theme.label}, ${presenceLabels[theme.presence]}. View journal entry.`}
    >
      <span className="font-medium transition-colors group-hover:text-foreground">
        {theme.label}
      </span>
      <span className="text-xs text-muted-foreground/75">
        {presenceLabels[theme.presence]} · {formatFullDate(mostRecentDate)}
      </span>
    </Link>
  );
}

export function aggregateThemes(entries: JournalEntry[], now: Date): RecurringTheme[] {
  const grouped = new Map<string, ThemeAggregate>();

  for (const entry of entries) {
    const entryDate = new Date(entry.createdAt);
    if (Number.isNaN(entryDate.getTime())) {
      continue;
    }

    const seenInEntry = new Set<string>();
    for (const rawTheme of entry.themes ?? []) {
      const key = rawTheme.trim().toLocaleLowerCase();
      if (!key || seenInEntry.has(key)) {
        continue;
      }
      seenInEntry.add(key);

      const existing = grouped.get(key);
      if (existing) {
        existing.entries.push({ entryId: entry.id, createdAt: entry.createdAt });
        existing.firstTouched =
          entryDate < existing.firstTouched ? entryDate : existing.firstTouched;
        existing.lastTouched =
          entryDate > existing.lastTouched ? entryDate : existing.lastTouched;
        existing.recurrenceCount = existing.entries.length;
      } else {
        grouped.set(key, {
          key,
          label: formatTheme(rawTheme),
          entries: [{ entryId: entry.id, createdAt: entry.createdAt }],
          firstTouched: entryDate,
          lastTouched: entryDate,
          recurrenceCount: 1,
        });
      }
    }
  }

  return [...grouped.values()]
    .filter((theme) => daysSince(theme.lastTouched, now) <= coldAfterDays)
    .map((theme) => ({ ...theme, presence: derivePresence(theme, now) }))
    .sort((left, right) => {
      const presenceDifference =
        presenceRank(right.presence) - presenceRank(left.presence);
      if (presenceDifference !== 0) {
        return presenceDifference;
      }

      return right.lastTouched.getTime() - left.lastTouched.getTime();
    });
}

export function derivePresence(theme: ThemeAggregate, now: Date): PresenceTier {
  const recentDays = daysSince(theme.lastTouched, now);
  if (recentDays > recentWithinDays || theme.recurrenceCount === 1) {
    return 'emerging';
  }

  const sortedTouches = [...theme.entries].sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );
  const hasMeaningfulGap = sortedTouches.some((touch, index) => {
    const previous = sortedTouches[index - 1];
    if (!previous) {
      return false;
    }

    return (
      daysSince(new Date(previous.createdAt), new Date(touch.createdAt)) >=
      returningGapDays
    );
  });

  return hasMeaningfulGap ? 'returning' : 'recurring';
}

function daysSince(date: Date, now: Date): number {
  const elapsed = startOfDay(now).getTime() - startOfDay(date).getTime();
  return Math.max(0, Math.floor(elapsed / dayInMilliseconds));
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function presenceRank(presence: PresenceTier): number {
  return presence === 'recurring' ? 3 : presence === 'returning' ? 2 : 1;
}
