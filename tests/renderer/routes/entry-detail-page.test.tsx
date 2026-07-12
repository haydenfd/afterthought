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

  it('renders both opening lenses, the deeper reflection, and inferred themes', async () => {
    const createdAt = new Date(2026, 6, 10, 14, 30).toISOString();
    Object.defineProperty(window, 'afterthought', {
      configurable: true,
      value: {
        ...window.afterthought,
        entries: {
          ...window.afterthought.entries,
          list: vi.fn().mockResolvedValue([
            {
              id: 'entry-one',
              createdAt,
              updatedAt: createdAt,
              prompt: 'What changed in the routine?',
              openingQuestions: [
                'What changed in the routine?',
                'What are you learning about your attention?',
              ],
              content: 'Uncertainty made every interruption feel urgent.',
              deeperReflection: {
                question: 'What makes the interruption feel easier to choose?',
                response:
                  'It gives me a quick answer while the larger work stays open.',
              },
              themes: ['attention', 'uncertainty'],
            },
          ]),
        },
      },
    });
    const path = `/calendar/${formatRouteDate(new Date(createdAt))}`;

    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/calendar/:date" element={<EntryDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText('What changed in the routine?')).toBeInTheDocument();
    expect(
      screen.getByText('What are you learning about your attention?'),
    ).toBeInTheDocument();
    expect(screen.getByText('A little deeper')).toBeInTheDocument();
    expect(
      screen.getByText('It gives me a quick answer while the larger work stays open.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Touched on: Attention · Uncertainty')).toBeInTheDocument();
  });
});
