import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { formatRouteDate } from '@/lib/dates';
import { EntryDetailPage } from '@/routes/entry-detail-page';

const initialAfterthoughtApi = window.afterthought;

describe('EntryDetailPage', () => {
  afterEach(() => {
    Object.defineProperty(window, 'afterthought', {
      configurable: true,
      value: initialAfterthoughtApi,
    });
  });

  it('offers a calm empty-today state with a writing action', async () => {
    Object.defineProperty(window, 'afterthought', {
      configurable: true,
      value: {
        ...window.afterthought,
        entries: {
          ...window.afterthought.entries,
          list: vi.fn().mockResolvedValue([]),
        },
      },
    });
    const todayPath = `/calendar/${formatRouteDate(new Date())}`;

    render(
      <MemoryRouter initialEntries={[todayPath]}>
        <Routes>
          <Route path="/calendar/:date" element={<EntryDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('No entries yet today.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start writing' })).toBeInTheDocument();
  });
});
