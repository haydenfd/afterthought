import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { formatRouteDate } from '@/lib/dates';
import { EntryDetailPage } from '@/routes/entry-detail-page';
import type { MemoryEvidenceItem } from '../../../src/shared/reflection';

const initialAfterthoughtApi = window.afterthought;
const sourceMemory: MemoryEvidenceItem = {
  id: 'memory-one',
  text: 'Earlier, unfinished work made a larger choice feel real.',
  similarity: 0.89,
  sourceDocumentIds: ['document-one'],
  sourceEntryIds: ['source-entry'],
};

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
    const sourceCreatedAt = new Date(2026, 6, 9, 10, 15).toISOString();
    Object.defineProperty(window, 'afterthought', {
      configurable: true,
      value: {
        ...window.afterthought,
        entries: {
          ...window.afterthought.entries,
          list: vi.fn().mockResolvedValue([
            {
              id: 'source-entry',
              createdAt: sourceCreatedAt,
              updatedAt: sourceCreatedAt,
              prompt: 'What felt unfinished?',
              content: 'An application made the bigger decision feel real.',
            },
            {
              id: 'entry-one',
              createdAt,
              updatedAt: createdAt,
              prompt: 'What changed in the routine?',
              openingQuestions: [
                'What changed in the routine?',
                'What are you learning about your attention?',
              ],
              openingContext: [sourceMemory],
              content: 'Uncertainty made every interruption feel urgent.',
              deeperReflection: {
                question: 'What makes the interruption feel easier to choose?',
                response:
                  'It gives me a quick answer while the larger work stays open.',
                provenance: {
                  strategy: 'connect-behavior-and-effect',
                  sourceMemoryIds: ['memory-one'],
                  sourceMemories: [sourceMemory],
                },
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
    expect(screen.getByText('Why this prompt appeared')).toBeInTheDocument();
    expect(screen.getByText('What this question drew from')).toBeInTheDocument();
    expect(
      screen.getAllByText('Earlier, unfinished work made a larger choice feel real.'),
    ).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'View source entry' })).toHaveLength(2);
    expect(screen.getByText('Touched on: Attention | Uncertainty')).toBeInTheDocument();
  });
});
