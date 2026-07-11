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

export interface CalendarDay {
  date: Date;
  dayNumber: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isFuture: boolean;
  hasEntry: boolean;
}

const exampleEntryDayNumbers = [1, 2, 3, 5, 6, 8, 10, 11, 14, 17, 21, 24, 27];

export function createMonthGrid(
  month: Date,
  today: Date = new Date(),
  markedDates: Date[] = getExampleJournalDates(month, today),
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

export function getExampleJournalDates(month: Date, today: Date = new Date()): Date[] {
  const monthStart = startOfMonth(month);
  const normalizedToday = startOfDay(today);

  return exampleEntryDayNumbers
    .map(
      (dayNumber) =>
        new Date(monthStart.getFullYear(), monthStart.getMonth(), dayNumber),
    )
    .filter((date) => isSameMonth(date, monthStart))
    .filter((date) => !isAfter(startOfDay(date), normalizedToday));
}

export function canNavigateToMonth(month: Date, today: Date = new Date()): boolean {
  return !isAfter(startOfMonth(month), startOfMonth(today));
}

export function isSelectableEntryDay(day: CalendarDay): boolean {
  return day.hasEntry && !day.isFuture && day.isCurrentMonth;
}

export function isPastMonth(month: Date, today: Date = new Date()): boolean {
  return isBefore(endOfMonth(month), startOfMonth(today));
}
