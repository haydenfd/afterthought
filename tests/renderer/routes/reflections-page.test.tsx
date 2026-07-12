import { render, screen } from '@testing-library/react';

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

    render(<ReflectionsPage />);

    expect(screen.getByText('Gathering your local memories…')).toBeInTheDocument();
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

function setMemoryRefresh(refresh: () => Promise<MemoryRefreshResult>): void {
  Object.defineProperty(window, 'afterthought', {
    configurable: true,
    value: { memory: { refresh } },
  });
}
