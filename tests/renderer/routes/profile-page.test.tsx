import { render, screen } from '@testing-library/react';

import { ProfilePage } from '@/routes/profile-page';
import type { MemoryRefreshResult } from '../../../src/shared/memory';

describe('ProfilePage', () => {
  it('renders the live Supermemory profile as editorial prose', async () => {
    setMemoryRefresh(
      vi.fn().mockResolvedValue({
        status: 'online',
        profile: {
          dynamic: ['Building has been energizing lately.'],
          static: ['Quiet focus matters most.'],
        },
        memories: [],
      } satisfies MemoryRefreshResult),
    );

    render(<ProfilePage />);

    expect(
      await screen.findByText('Building has been energizing lately.'),
    ).toBeInTheDocument();
    expect(screen.getByText('What seems to be shifting')).toBeInTheDocument();
    expect(screen.getByText('Quiet focus matters most.')).toBeInTheDocument();
    expect(screen.getByText('What holds steady')).toBeInTheDocument();
  });

  it('shows a calm empty state when nothing has been remembered yet', async () => {
    setMemoryRefresh(
      vi.fn().mockResolvedValue({
        status: 'online',
        profile: { dynamic: [], static: [] },
        memories: [],
      } satisfies MemoryRefreshResult),
    );

    render(<ProfilePage />);

    expect(await screen.findByText(/This page is quiet for now/)).toBeInTheDocument();
  });

  it('keeps sourced threads visible alongside the longitudinal profile', async () => {
    setMemoryRefresh(
      vi.fn().mockResolvedValue({
        status: 'online',
        profile: {
          dynamic: ['Building has been energizing lately.'],
          static: [],
        },
        memories: [
          {
            id: 'memory-one',
            text: 'Making time to build changed the shape of the week.',
            sourceEntryIds: ['entry-one'],
          },
        ],
        threads: [
          {
            id: 'making-space',
            title: 'Making space to build',
            summary: 'Protected creative time is becoming easier to recognize.',
            kind: 'shifting',
            sourceMemoryIds: ['memory-one'],
            sourceEntryIds: ['entry-one'],
          },
        ],
      } satisfies MemoryRefreshResult),
    );

    render(<ProfilePage />);

    expect(await screen.findByText('Making space to build')).toBeInTheDocument();
    expect(screen.getByText('Threads shaping this portrait')).toBeInTheDocument();
  });

  it('stays calm and local-first when Supermemory is offline', async () => {
    setMemoryRefresh(vi.fn().mockRejectedValue(new Error('offline')));

    render(<ProfilePage />);

    expect(await screen.findByText('This portrait is resting')).toBeInTheDocument();
  });
});

function setMemoryRefresh(refresh: () => Promise<MemoryRefreshResult>): void {
  Object.defineProperty(window, 'afterthought', {
    configurable: true,
    value: { memory: { refresh } },
  });
}
