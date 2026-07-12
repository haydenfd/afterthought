import { format } from 'date-fns';

import {
  countEntriesInMonth,
  createMonthGrid,
  groupEntriesByLocalDate,
} from '@/lib/calendar';
import { formatRouteDate } from '@/lib/dates';
import type { JournalEntry } from '../../shared/journal-entry';

describe('calendar utilities', () => {
  it('marks real local entry dates without marking future days', () => {
    const today = new Date(2026, 6, 11);
    const month = new Date(2026, 6, 1);
    const markedDates = [new Date(2026, 6, 10), new Date(2026, 6, 11)];
    const grid = createMonthGrid(month, today, markedDates);

    expect(markedDates).toHaveLength(2);
    expect(markedDates.map(formatRouteDate)).toContain('2026-07-11');
    expect(grid.filter((day) => day.hasEntry)).toHaveLength(2);
    expect(grid.some((day) => day.hasEntry && day.isFuture)).toBe(false);
  });

  it('groups multiple entries by local date instead of slicing their ISO strings', () => {
    const localDate = new Date(2026, 6, 2, 0, 30);
    const entries: JournalEntry[] = [
      entry('one', localDate.toISOString()),
      entry('two', new Date(2026, 6, 2, 12, 0).toISOString()),
    ];

    const groups = groupEntriesByLocalDate(entries);
    const expectedDate = format(localDate, 'yyyy-MM-dd');

    expect(groups.get(expectedDate)).toHaveLength(2);
    expect([...groups.values()].flat()).toHaveLength(2);
  });

  it('counts every real entry in the visible local month', () => {
    const entries: JournalEntry[] = [
      entry('one', new Date(2026, 6, 2, 0, 30).toISOString()),
      entry('two', new Date(2026, 6, 2, 12, 0).toISOString()),
      entry('three', new Date(2026, 5, 30, 12, 0).toISOString()),
    ];

    expect(countEntriesInMonth(entries, new Date(2026, 6, 1))).toBe(2);
  });
});

function entry(id: string, createdAt: string): JournalEntry {
  return {
    id,
    createdAt,
    updatedAt: createdAt,
    prompt: 'Prompt',
    content: 'Content',
  };
}
