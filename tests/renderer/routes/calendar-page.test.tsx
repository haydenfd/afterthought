import { fireEvent, render, screen } from '@testing-library/react';
import { format, startOfMonth } from 'date-fns';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { CalendarPage } from '@/routes/calendar-page';
import { createMonthGrid } from '@/lib/calendar';
import { formatRouteDate } from '@/lib/dates';

const initialAfterthoughtApi = window.afterthought;

describe('CalendarPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    Object.defineProperty(window, 'afterthought', {
      configurable: true,
      value: initialAfterthoughtApi,
    });
  });

  it('keeps adjacent-month cells blank and renders a date-led journal feed', async () => {
    const entryDate = entryDateInCurrentMonth();
    const content =
      'The quiet part of the morning gave me enough room to notice what I was avoiding.';
    setEntries([
      entry('one', entryDate, content, 'A title that should not render'),
      entry(
        'two',
        new Date(entryDate.getTime() + 60 * 60 * 1000),
        'A second note from the same day.',
      ),
    ]);

    renderCalendar();

    expect(await screen.findByText(content)).toBeInTheDocument();
    expect(
      screen.queryByText('A title that should not render'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('This month')).not.toBeInTheDocument();
    expect(
      screen.getByText(
        `${format(entryDate, 'EEEE, MMMM d')} · ${format(entryDate, 'h:mm a')}`,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('status', { name: '2 entries' })).toBeInTheDocument();

    const adjacentDay = createMonthGrid(startOfMonth(entryDate), new Date()).find(
      (day) => !day.isCurrentMonth,
    );
    expect(adjacentDay).toBeDefined();
    expect(
      screen.queryByRole('button', {
        name: new RegExp(format(adjacentDay!.date, 'MMMM d, yyyy')),
      }),
    ).not.toBeInTheDocument();
  });

  it('makes today distinct while keeping entry-day treatment', async () => {
    const today = new Date();
    setEntries([entry('one', today, 'Today was worth remembering.')]);

    renderCalendar();

    const todayButton = await screen.findByRole('button', {
      name: new RegExp(`${format(today, 'MMMM d, yyyy')}, today, 1 entry`),
    });

    expect(todayButton).toHaveAttribute('aria-current', 'date');
    expect(todayButton).toHaveClass('bg-accent/55');
    expect(todayButton).toHaveClass('ring-primary/80');
  });

  it('limits the monthly feed to the five newest entries', async () => {
    const entryDate = entryDateInCurrentMonth();
    const entries = Array.from({ length: 6 }, (_, index) =>
      entry(
        `entry-${index}`,
        new Date(entryDate.getTime() + index * 60 * 60 * 1000),
        `Entry preview ${index + 1}`,
      ),
    );
    setEntries(entries);

    renderCalendar();

    expect(await screen.findByText('Entry preview 6')).toBeInTheDocument();
    expect(screen.getByText('Entry preview 2')).toBeInTheDocument();
    expect(screen.queryByText('Entry preview 1')).not.toBeInTheDocument();
  });

  it('navigates from a feed item to the existing date detail route', async () => {
    const entryDate = entryDateInCurrentMonth();
    setEntries([entry('one', entryDate, 'A note that opens by date.')]);

    render(
      <MemoryRouter initialEntries={['/calendar']}>
        <Routes>
          <Route path="/calendar" element={<CalendarPage />} />
          <Route
            path="/calendar/:date"
            element={<p>Opened {formatRouteDate(entryDate)}</p>}
          />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(
      await screen.findByRole('link', { name: /A note that opens by date/ }),
    );

    expect(
      await screen.findByText(`Opened ${formatRouteDate(entryDate)}`),
    ).toBeInTheDocument();
  });

  it('offers a writing action when the visible month is empty', async () => {
    setEntries([]);

    renderCalendar();

    expect(await screen.findByText('Nothing written here yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start writing' })).toHaveAttribute(
      'href',
      '/entry/new',
    );
  });

  it('stops previous-month navigation at the installation month', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 6, 14));
    setEntries([], new Date(2026, 6, 1));

    renderCalendar();

    expect(
      await screen.findByRole('button', { name: 'Previous month' }),
    ).toBeDisabled();
  });

  it('does not offer a writing CTA for an empty past month', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 7, 14));
    setEntries([], new Date(2026, 6, 1));

    renderCalendar();

    fireEvent.click(await screen.findByRole('button', { name: 'Previous month' }));

    expect(await screen.findByText('Nothing written this month.')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Start writing' }),
    ).not.toBeInTheDocument();
  });
});

function renderCalendar(): void {
  render(
    <MemoryRouter initialEntries={['/calendar']}>
      <Routes>
        <Route path="/calendar" element={<CalendarPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function setEntries(entries: ReturnType<typeof entry>[], installedAt?: Date): void {
  Object.defineProperty(window, 'afterthought', {
    configurable: true,
    value: {
      ...window.afterthought,
      entries: {
        ...window.afterthought.entries,
        list: vi.fn().mockResolvedValue(entries),
      },
      preferences: {
        ...window.afterthought.preferences,
        get: vi
          .fn()
          .mockResolvedValue(
            installedAt ? { installedAt: installedAt.toISOString() } : {},
          ),
      },
    },
  });
}

function entry(id: string, createdAt: Date, content: string, title?: string) {
  return {
    id,
    createdAt: createdAt.toISOString(),
    updatedAt: createdAt.toISOString(),
    prompt: 'Prompt',
    content,
    ...(title ? { title } : {}),
  };
}

function entryDateInCurrentMonth(): Date {
  const today = new Date();
  const day = Math.min(today.getDate(), 20);
  return new Date(today.getFullYear(), today.getMonth(), day, 9, 30);
}
