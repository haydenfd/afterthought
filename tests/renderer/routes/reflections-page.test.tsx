import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { ReflectionsPage } from '@/routes/reflections-page';
import type { MemoryRefreshResult } from '../../../src/shared/memory';
import type { TemporalMirrorResult } from '../../../src/shared/reflection';

describe('ReflectionsPage', () => {
  it('shows loading and then the distilled empty state', async () => {
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
      await screen.findByText(
        'Nothing has been distilled yet. Finish an entry and it will surface here.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('A named worry became more manageable.'),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Refresh' })).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Supermemory keeps the source moments/),
    ).not.toBeInTheDocument();
  });

  it('shows an empty online state without treating it as an error', async () => {
    setMemoryRefresh(
      vi.fn().mockResolvedValue({
        status: 'online',
        profile: { dynamic: [], static: [] },
        memories: [],
      } satisfies MemoryRefreshResult),
    );

    render(
      <MemoryRouter>
        <ReflectionsPage />
      </MemoryRouter>,
    );

    expect(
      await screen.findByText(
        'Nothing has been distilled yet. Finish an entry and it will surface here.',
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
          themes: ['attention'],
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
    expect(screen.queryByText('July 10, 2026')).not.toBeInTheDocument();
    expect(screen.queryByText('View source entry')).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Recurring themes' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Themes returning in your writing lately.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Attention, just came up/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Threads to revisit' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('A few patterns from your recent entries, worth a second look.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Temporal Mirror' }),
    ).toBeInTheDocument();
    const headingTexts = screen
      .getAllByRole('heading')
      .map((heading) => heading.textContent);
    expect(headingTexts.indexOf('Recurring themes')).toBeLessThan(
      headingTexts.indexOf('Threads to revisit'),
    );
    expect(headingTexts.indexOf('Threads to revisit')).toBeLessThan(
      headingTexts.indexOf('Temporal Mirror'),
    );
    expect(screen.queryByText('A little perspective')).not.toBeInTheDocument();
    expect(screen.queryByText('The reflection loop')).not.toBeInTheDocument();
    expect(
      screen.queryByText('The phone cutoff made mornings feel less rushed.'),
    ).not.toBeInTheDocument();
  });

  it('explains when Groq cannot synthesize threads without showing source excerpts', async () => {
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
    expect(
      screen.queryByText('A source moment remains available.'),
    ).not.toBeInTheDocument();
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

  it('lets someone compare earlier and later source moments', async () => {
    const temporalMirror = vi.fn().mockResolvedValue({
      status: 'available',
      query: 'What has changed in how I relate to uncertainty?',
      then: {
        summary: 'Earlier, uncertainty made the decision feel impossible to name.',
        sourceMemoryIds: ['memory-old'],
        sourceEntryIds: ['entry-old'],
      },
      now: {
        summary: 'Now, the decision feels clearer even though it is not settled.',
        sourceMemoryIds: ['memory-new'],
        sourceEntryIds: ['entry-new'],
      },
      shifted: 'The question is becoming more about choosing than certainty.',
      unresolved: 'The cost of choosing still feels real.',
      sourceMemories: [
        {
          id: 'memory-old',
          text: 'I keep circling the decision because uncertainty feels unsafe.',
          similarity: 0.92,
          sourceDate: '2026-06-01T12:00:00.000Z',
          sourceDocumentIds: [],
          sourceEntryIds: ['entry-old'],
        },
        {
          id: 'memory-new',
          text: 'I can see what I value now, even if I am not ready to decide.',
          similarity: 0.88,
          sourceDate: '2026-07-12T12:00:00.000Z',
          sourceDocumentIds: [],
          sourceEntryIds: ['entry-new'],
        },
      ],
    } satisfies TemporalMirrorResult);
    setMemoryRefresh(
      vi.fn().mockResolvedValue({
        status: 'online',
        profile: { dynamic: [], static: [] },
        memories: [],
      } satisfies MemoryRefreshResult),
      [
        {
          id: 'entry-old',
          createdAt: '2026-06-01T12:00:00.000Z',
          updatedAt: '2026-06-01T12:00:00.000Z',
          prompt: '',
          content: 'I keep circling the decision.',
        },
        {
          id: 'entry-new',
          createdAt: '2026-07-12T12:00:00.000Z',
          updatedAt: '2026-07-12T12:00:00.000Z',
          prompt: '',
          content: 'I can see what I value now.',
        },
      ],
      temporalMirror,
    );

    render(
      <MemoryRouter>
        <ReflectionsPage />
      </MemoryRouter>,
    );

    const input = await screen.findByLabelText('Ask your journal');
    fireEvent.change(input, {
      target: { value: 'What has changed in how I relate to uncertainty?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Compare moments' }));

    expect(await screen.findByText('Temporal Mirror')).toBeInTheDocument();
    expect(screen.getByText('Then')).toBeInTheDocument();
    expect(screen.getByText('Now')).toBeInTheDocument();
    expect(screen.getByText('What shifted')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'View source entry' })).toHaveLength(2);
    expect(temporalMirror).toHaveBeenCalledWith(
      'What has changed in how I relate to uncertainty?',
    );
  });
});

function setMemoryRefresh(
  refresh: () => Promise<MemoryRefreshResult>,
  entries: unknown[] = [],
  temporalMirror: (query: string) => Promise<TemporalMirrorResult> = vi
    .fn()
    .mockResolvedValue({
      status: 'insufficient',
      query: '',
      message: 'No temporal mirror result.',
    }),
): void {
  Object.defineProperty(window, 'afterthought', {
    configurable: true,
    value: {
      memory: { refresh },
      entries: { list: vi.fn().mockResolvedValue(entries) },
      reflection: { temporalMirror },
    },
  });
}
