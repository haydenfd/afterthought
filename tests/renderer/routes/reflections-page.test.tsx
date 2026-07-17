import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { ReflectionsPage } from '@/routes/reflections-page';
import type { MemoryRefreshResult } from '../../../src/shared/memory';

describe('ReflectionsPage', () => {
  it('shows loading and then the remembered moments', async () => {
    const result: MemoryRefreshResult = {
      status: 'online',
      profile: {
        dynamic: ['Building has been energizing lately.'],
        static: ['Quiet focus matters.'],
      },
      memories: [
        {
          id: 'memory-one',
          text: 'A named worry became more manageable.',
          sourceDate: '2026-07-10T15:30:00-07:00',
        },
      ],
    };
    setMemoryRefresh(vi.fn().mockResolvedValue(result));

    render(
      <MemoryRouter>
        <ReflectionsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('Gathering remembered moments…')).toBeInTheDocument();
    expect(
      await screen.findByText('A named worry became more manageable.'),
    ).toBeInTheDocument();
  });

  it('shows an empty online state without treating it as an error', async () => {
    setMemoryRefresh(
      vi.fn().mockResolvedValue({
        status: 'online',
        profile: { dynamic: [], static: [] },
        memories: [],
      } satisfies MemoryRefreshResult),
    );

    render(<ReflectionsPage />);

    expect(
      await screen.findByText(
        'Nothing has been remembered yet. Finish an entry and it will surface here.',
      ),
    ).toBeInTheDocument();
  });

  it('shows sourced threads and links them back to local entries', async () => {
    setMemoryRefresh(
      vi.fn().mockResolvedValue({
        status: 'online',
        profile: { dynamic: [], static: [] },
        memories: [
          {
            id: 'memory-one',
            text: 'The phone cutoff made mornings feel less rushed.',
            sourceDate: '2026-07-10T15:30:00-07:00',
            sourceEntryIds: ['entry-one'],
          },
        ],
        threads: [
          {
            id: 'attention-and-rest',
            title: 'Attention and rest',
            summary: 'A new boundary is helping mornings feel less rushed.',
            kind: 'progress',
            sourceMemoryIds: ['memory-one'],
            sourceEntryIds: ['entry-one'],
            nextQuestion: 'What helps this boundary feel chosen?',
          },
        ],
      } satisfies MemoryRefreshResult),
      [
        {
          id: 'entry-one',
          createdAt: '2026-07-10T15:30:00-07:00',
          updatedAt: '2026-07-10T15:30:00-07:00',
          prompt: '',
          content: 'I wrote about a new boundary.',
        },
      ],
    );

    render(
      <MemoryRouter>
        <ReflectionsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Attention and rest')).toBeInTheDocument();
    expect(
      screen.getByText('What helps this boundary feel chosen?'),
    ).toBeInTheDocument();
    expect(
      screen
        .getAllByRole('link', { name: 'View source entry' })
        .every((link) => link.getAttribute('href') === '/calendar/2026-07-10'),
    ).toBe(true);
    expect(screen.getAllByText('July 10, 2026')).not.toHaveLength(0);
    expect(screen.getByText('The reflection loop')).toBeInTheDocument();
  });

  it('explains when Groq cannot synthesize threads without hiding source memories', async () => {
    setMemoryRefresh(
      vi.fn().mockResolvedValue({
        status: 'online',
        profile: { dynamic: [], static: [] },
        memories: [
          {
            id: 'memory-one',
            text: 'A source moment remains available.',
          },
        ],
        insights: {
          status: 'unavailable',
          message:
            'Groq synthesis is unavailable right now. Source memories are still available below.',
        },
      } satisfies MemoryRefreshResult),
    );

    render(<ReflectionsPage />);

    expect(
      await screen.findByText(
        'Groq synthesis is unavailable right now. Source memories are still available below.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('A source moment remains available.')).toBeInTheDocument();
  });

  it('offers a retry when an entry still needs indexing', async () => {
    const retryIngestion = vi.fn().mockResolvedValue({
      status: 'ready',
      pending: 0,
      processing: 0,
      failed: 0,
      complete: 1,
    });
    const refresh = vi
      .fn()
      .mockResolvedValueOnce({
        status: 'online',
        profile: { dynamic: [], static: [] },
        memories: [],
        ingestion: {
          status: 'attention',
          pending: 0,
          processing: 0,
          failed: 1,
          complete: 0,
          message: '1 reflection needs memory indexing attention.',
        },
      } satisfies MemoryRefreshResult)
      .mockResolvedValueOnce({
        status: 'online',
        profile: { dynamic: [], static: [] },
        memories: [],
        ingestion: {
          status: 'ready',
          pending: 0,
          processing: 0,
          failed: 0,
          complete: 1,
        },
      } satisfies MemoryRefreshResult);
    setMemoryRefresh(refresh, [], retryIngestion);

    render(<ReflectionsPage />);

    const retryButton = await screen.findByRole('button', { name: 'Retry indexing' });
    fireEvent.click(retryButton);

    await waitFor(() => expect(retryIngestion).toHaveBeenCalledOnce());
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Memory index is ready')).toBeInTheDocument();
  });

  it('keeps a calm local-first view when Supermemory is offline', async () => {
    setMemoryRefresh(vi.fn().mockRejectedValue(new Error('offline')));

    render(<ReflectionsPage />);

    expect(await screen.findByText('Memory is resting')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Supermemory Local is unavailable. Your journal remains saved locally.',
      ),
    ).toBeInTheDocument();
  });
});

function setMemoryRefresh(
  refresh: () => Promise<MemoryRefreshResult>,
  entries: unknown[] = [],
  retryIngestion: () => Promise<unknown> = vi.fn().mockResolvedValue(undefined),
): void {
  Object.defineProperty(window, 'afterthought', {
    configurable: true,
    value: {
      memory: { refresh, retryIngestion },
      entries: { list: vi.fn().mockResolvedValue(entries) },
    },
  });
}
