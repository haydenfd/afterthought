import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { AppProviders } from '@/app-providers';
import { AppRoutes } from '@/App';

const initialAfterthoughtApi = window.afterthought;

describe('App', () => {
  afterEach(() => {
    Object.defineProperty(window, 'afterthought', {
      configurable: true,
      value: initialAfterthoughtApi,
    });
  });

  it('opens on Calendar without generating an opening question', async () => {
    const openingQuestions = vi.fn();
    const currentApi = window.afterthought;
    Object.defineProperty(window, 'afterthought', {
      configurable: true,
      value: {
        ...currentApi,
        reflection: { openingQuestions },
      },
    });

    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/']}>
          <AppRoutes />
        </MemoryRouter>
      </AppProviders>,
    );

    expect(screen.getByText('Afterthought')).toBeInTheDocument();
    expect(await screen.findByText(/entries this month/)).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'New Entry' })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'New Entry' })).toHaveAttribute(
      'href',
      '/entry/new',
    );
    expect(screen.queryByRole('button', { name: 'New Entry' })).not.toBeInTheDocument();
    expect(screen.queryByText('Today')).not.toBeInTheDocument();
    expect(openingQuestions).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Hide sidebar' }));

    expect(screen.getByRole('button', { name: 'Show sidebar' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'New Entry' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('navigation', { name: 'Primary' }),
    ).not.toBeInTheDocument();
  });

  it('returns to Calendar and reloads entries after finishing a new entry', async () => {
    const openingQuestions = vi
      .fn()
      .mockResolvedValue({ questions: null, source: 'fallback' });
    const create = vi.fn().mockResolvedValue({ id: 'entry-id' });
    const list = vi.fn().mockResolvedValue([
      {
        id: 'entry-id',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        prompt: 'What has been taking up more space in your mind than you expected?',
        content: 'A thought worth keeping.',
      },
    ]);
    const currentApi = window.afterthought;
    Object.defineProperty(window, 'afterthought', {
      configurable: true,
      value: {
        ...currentApi,
        entries: { ...currentApi.entries, create, list },
        reflection: { openingQuestions },
      },
    });

    render(
      <AppProviders>
        <MemoryRouter initialEntries={['/entry/new']}>
          <AppRoutes />
        </MemoryRouter>
      </AppProviders>,
    );

    fireEvent.change(await screen.findByLabelText('Journal entry'), {
      target: { value: 'A thought worth keeping.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));

    const page = screen.getByTestId('reflection-page');
    await waitFor(() => expect(page).toHaveClass('reflection-page--closing'));
    fireEvent.animationEnd(page, { animationName: 'reflection-page-crumple' });

    expect(
      await screen.findByText(
        'Your reflection has been saved.',
        {},
        { timeout: 1_700 },
      ),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('1 entry this month', {}, { timeout: 3_000 }),
    ).toBeInTheDocument();
    expect(list).toHaveBeenCalledTimes(1);
  });
});
