import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import {
  aggregateThemes,
  derivePresence,
  RecurringThemes,
  type ThemeAggregate,
} from '@/components/memory/recurring-themes';
import type { JournalEntry } from '../../../src/shared/journal-entry';

const now = new Date('2026-07-17T12:00:00.000Z');

describe('recurring themes', () => {
  it('groups case variants and preserves the first display label', () => {
    const themes = aggregateThemes(
      [
        entry('one', '2026-07-15', ['friendship']),
        entry('two', '2026-07-16', ['Friendship', 'screen time']),
      ],
      now,
    );

    expect(themes.map((theme) => theme.label)).toEqual(['Friendship', 'Screen time']);
    expect(themes[0]?.recurrenceCount).toBe(2);
  });

  it('derives deterministic presence tiers from an injected date', () => {
    expect(derivePresence(theme(['2026-07-16']), now)).toBe('emerging');
    expect(derivePresence(theme(['2026-07-10', '2026-07-16']), now)).toBe('recurring');
    expect(derivePresence(theme(['2026-06-01', '2026-07-16']), now)).toBe('returning');
  });

  it('lets a recent single touch outrank a cold recurring theme', () => {
    const themes = aggregateThemes(
      [
        entry('old-one', '2026-05-01', ['work']),
        entry('old-two', '2026-05-03', ['work']),
        entry('old-three', '2026-05-05', ['work']),
        entry('new', '2026-07-16', ['friendship']),
      ],
      now,
    );

    expect(themes.map((item) => item.label)).toEqual(['Friendship']);
  });

  it('links each theme to its most recent entry without rendering counts', () => {
    render(
      <MemoryRouter>
        <RecurringThemes
          now={now}
          entries={[
            entry('old', '2026-07-01', ['friendship']),
            entry('new', '2026-07-16', ['Friendship']),
          ]}
        />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { name: 'Recurring themes' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Friendship')).toBeInTheDocument();
    expect(
      screen.getByText('Themes returning in your writing lately.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Friendship, back again/ }),
    ).toHaveAttribute('href', '/calendar/2026-07-16');
    expect(screen.queryByText(/July 16, 2026/)).not.toBeInTheDocument();
    expect(screen.queryByText(/source|times|%/i)).not.toBeInTheDocument();
  });

  it('renders nothing when all themes have decayed off', () => {
    const { container } = render(
      <MemoryRouter>
        <RecurringThemes
          now={now}
          entries={[entry('old', '2026-06-01', ['friendship'])]}
        />
      </MemoryRouter>,
    );

    expect(container).toBeEmptyDOMElement();
  });
});

function entry(id: string, createdAt: string, themes: string[]): JournalEntry {
  return {
    id,
    createdAt: `${createdAt}T12:00:00.000Z`,
    updatedAt: `${createdAt}T12:00:00.000Z`,
    prompt: '',
    content: '',
    themes,
  };
}

function theme(dates: string[]): ThemeAggregate {
  const entries = dates.map((date, index) => ({
    entryId: `entry-${index}`,
    createdAt: `${date}T12:00:00.000Z`,
  }));

  return {
    key: 'friendship',
    label: 'Friendship',
    entries,
    firstTouched: new Date(entries[0]!.createdAt),
    lastTouched: new Date(entries[entries.length - 1]!.createdAt),
    recurrenceCount: entries.length,
  };
}
