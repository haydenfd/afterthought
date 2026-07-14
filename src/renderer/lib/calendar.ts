import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';

import type { JournalEntry } from '../../shared/journal-entry';

export interface CalendarDay {
  date: Date;
  dayNumber: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isFuture: boolean;
  hasEntry: boolean;
}

export function createMonthGrid(
  month: Date,
  today: Date = new Date(),
  markedDates: Date[] = [],
): CalendarDay[] {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(monthEnd);
  const normalizedToday = startOfDay(today);
  const days: CalendarDay[] = [];

  for (let day = gridStart; !isAfter(day, gridEnd); day = addDays(day, 1)) {
    const date = startOfDay(day);
    days.push({
      date,
      dayNumber: format(date, 'd'),
      isCurrentMonth: isSameMonth(date, monthStart),
      isToday: isSameDay(date, normalizedToday),
      isFuture: isAfter(date, normalizedToday),
      hasEntry: markedDates.some((markedDate) => isSameDay(date, markedDate)),
    });
  }

  return days;
}

export function groupEntriesByLocalDate(
  entries: JournalEntry[],
): Map<string, JournalEntry[]> {
  return entries.reduce((groups, entry) => {
    const date = new Date(entry.createdAt);

    if (Number.isNaN(date.getTime())) {
      return groups;
    }

    const key = format(date, 'yyyy-MM-dd');
    const existingEntries = groups.get(key) ?? [];
    groups.set(key, [...existingEntries, entry]);
    return groups;
  }, new Map<string, JournalEntry[]>());
}

export function countEntriesInMonth(entries: JournalEntry[], month: Date): number {
  return entries.filter((entry) => {
    const date = new Date(entry.createdAt);
    return !Number.isNaN(date.getTime()) && isSameMonth(date, month);
  }).length;
}

export function canNavigateToMonth(month: Date, today: Date = new Date()): boolean {
  return !isAfter(startOfMonth(month), startOfMonth(today));
}

export function canNavigateToMonthFrom(month: Date, minimumMonth: Date): boolean {
  return !isBefore(startOfMonth(month), startOfMonth(minimumMonth));
}

export function isSelectableEntryDay(day: CalendarDay): boolean {
  return day.hasEntry && !day.isFuture && day.isCurrentMonth;
}

export function isPastMonth(month: Date, today: Date = new Date()): boolean {
  return isBefore(endOfMonth(month), startOfMonth(today));
}
