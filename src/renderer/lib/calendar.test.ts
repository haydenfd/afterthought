import { parseISO } from 'date-fns';

import { createMonthGrid, getExampleJournalDates } from '@/lib/calendar';
import { formatRouteDate } from '@/lib/dates';

describe('calendar utilities', () => {
  it('marks eight sample entries in the current scaffold month without future dates', () => {
    const today = parseISO('2026-07-11');
    const month = parseISO('2026-07-01');
    const markedDates = getExampleJournalDates(month, today);
    const grid = createMonthGrid(month, today, markedDates);

    expect(markedDates).toHaveLength(8);
    expect(markedDates.map(formatRouteDate)).toContain('2026-07-11');
    expect(grid.filter((day) => day.hasEntry)).toHaveLength(8);
    expect(grid.some((day) => day.hasEntry && day.isFuture)).toBe(false);
  });
});
