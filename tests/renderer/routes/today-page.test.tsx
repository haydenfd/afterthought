import { render, screen } from '@testing-library/react';

import { TodayPage } from '@/routes/today-page';
import { DraftProvider } from '@/state/draft-context';
import type { OpeningQuestionsResult } from '../../../src/shared/reflection';

describe('TodayPage', () => {
  it('shows the static fallback prompt when there is no AI question', async () => {
    setOpeningQuestions(
      vi.fn().mockResolvedValue({ primaryQuestion: null, source: 'fallback' }),
    );

    render(
      <DraftProvider>
        <TodayPage />
      </DraftProvider>,
    );

    expect(
      await screen.findByText(
        'What has been taking up more space in your mind than you expected?',
      ),
    ).toBeInTheDocument();
  });

  it('shows only the primary AI-generated question when available', async () => {
    setOpeningQuestions(
      vi.fn().mockResolvedValue({
        primaryQuestion: 'Have you kept up the phone cutoff this week?',
        source: 'ai',
      } satisfies OpeningQuestionsResult),
    );

    render(
      <DraftProvider>
        <TodayPage />
      </DraftProvider>,
    );

    expect(
      await screen.findByText('Have you kept up the phone cutoff this week?'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        'What has been taking up more space in your mind than you expected?',
      ),
    ).not.toBeInTheDocument();
  });

  it('falls back to the static prompt if the IPC call rejects', async () => {
    setOpeningQuestions(vi.fn().mockRejectedValue(new Error('no bridge')));

    render(
      <DraftProvider>
        <TodayPage />
      </DraftProvider>,
    );

    expect(
      await screen.findByText(
        'What has been taking up more space in your mind than you expected?',
      ),
    ).toBeInTheDocument();
  });
});

function setOpeningQuestions(
  openingQuestions: () => Promise<OpeningQuestionsResult>,
): void {
  Object.defineProperty(window, 'afterthought', {
    configurable: true,
    value: {
      entries: { create: vi.fn(), get: vi.fn(), list: vi.fn().mockResolvedValue([]) },
      reflection: { openingQuestions },
    },
  });
}
