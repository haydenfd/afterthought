import { format, parseISO } from 'date-fns';

export const journalDateParamFormat = 'yyyy-MM-dd';

export function formatFullDate(date: Date): string {
  return format(date, 'MMMM d, yyyy');
}

export function formatWeekday(date: Date): string {
  return format(date, 'EEEE');
}

export function formatRouteDate(date: Date): string {
  return format(date, journalDateParamFormat);
}

export function parseRouteDate(value: string | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
