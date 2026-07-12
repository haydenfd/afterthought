import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { NewEntryPage } from '@/routes/new-entry-page';
import { DraftProvider } from '@/state/draft-context';
import type { OpeningQuestionsResult } from '../../../src/shared/reflection';

const initialAfterthoughtApi = window.afterthought;

describe('NewEntryPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'afterthought', {
      configurable: true,
      value: initialAfterthoughtApi,
    });
  });

  it('shows a calm loading state while the opening question is generated once', () => {
    const openingQuestions = vi
      .fn()
      .mockReturnValue(new Promise<OpeningQuestionsResult>(() => {}));
    setAfterthoughtApi(openingQuestions);

    renderPage();

    expect(screen.getByText('Preparing a quiet place to begin')).toBeInTheDocument();
    expect(screen.queryByLabelText('Journal entry')).not.toBeInTheDocument();
    expect(openingQuestions).toHaveBeenCalledTimes(1);
  });

  it('shows the static fallback prompt when there is no AI question', async () => {
    setAfterthoughtApi(
      vi.fn().mockResolvedValue({ questions: null, source: 'fallback' }),
    );

    renderPage();

    expect(
      await screen.findByText(
        'What has been taking up more space in your mind than you expected?',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Today's prompt")).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Finish' })).toBeDisabled();
  });

  it('shows only the primary AI-generated question when available', async () => {
    setAfterthoughtApi(
      vi.fn().mockResolvedValue({
        questions: [
          'What changed when you kept the phone cutoff last night?',
          'What are you learning about protecting your mornings?',
        ],
        source: 'ai',
      } satisfies OpeningQuestionsResult),
    );

    renderPage();

    expect(
      await screen.findByText(
        'What changed when you kept the phone cutoff last night?',
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        'What has been taking up more space in your mind than you expected?',
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('What are you learning about protecting your mornings?'),
    ).toBeInTheDocument();
  });

  it('falls back to the static prompt if the IPC call rejects', async () => {
    setAfterthoughtApi(vi.fn().mockRejectedValue(new Error('no bridge')));

    renderPage();

    expect(
      await screen.findByText(
        'What has been taking up more space in your mind than you expected?',
      ),
    ).toBeInTheDocument();
  });

  it('asks before discarding unfinished writing', async () => {
    setAfterthoughtApi(
      vi.fn().mockResolvedValue({ questions: null, source: 'fallback' }),
    );
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);

    renderPage();

    fireEvent.change(await screen.findByLabelText('Journal entry'), {
      target: { value: 'A thought worth keeping.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Back to Calendar' }));

    expect(confirm).toHaveBeenCalledWith('Discard this unfinished journal entry?');
    expect(screen.getByLabelText('Journal entry')).toHaveValue(
      'A thought worth keeping.',
    );
  });

  it('guards browser-style back navigation when the draft has text', async () => {
    setAfterthoughtApi(
      vi.fn().mockResolvedValue({ questions: null, source: 'fallback' }),
    );
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const historyGo = vi.spyOn(window.history, 'go').mockImplementation(() => {});

    renderPage();

    fireEvent.change(await screen.findByLabelText('Journal entry'), {
      target: { value: 'A thought worth keeping.' },
    });
    window.dispatchEvent(new PopStateEvent('popstate'));

    expect(confirm).toHaveBeenCalledWith('Discard this unfinished journal entry?');
    expect(historyGo).toHaveBeenCalledWith(1);
  });

  it('saves the entry and shows the brief completion state', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'entry-id' });
    setAfterthoughtApi(
      vi.fn().mockResolvedValue({ questions: null, source: 'fallback' }),
      create,
    );

    renderPage();

    fireEvent.change(await screen.findByLabelText('Journal entry'), {
      target: { value: 'A thought worth keeping.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));

    expect(await screen.findByText('Your entry has been saved.')).toBeInTheDocument();
    expect(create).toHaveBeenCalledWith({
      prompt: 'What has been taking up more space in your mind than you expected?',
      content: 'A thought worth keeping.',
    });
  });
});

function renderPage(): void {
  render(
    <MemoryRouter initialEntries={['/entry/new']}>
      <DraftProvider>
        <NewEntryPage />
      </DraftProvider>
    </MemoryRouter>,
  );
}

function setAfterthoughtApi(
  openingQuestions: () => Promise<OpeningQuestionsResult>,
  create = vi.fn(),
): void {
  Object.defineProperty(window, 'afterthought', {
    configurable: true,
    value: {
      entries: { create, get: vi.fn(), list: vi.fn().mockResolvedValue([]) },
      reflection: { openingQuestions },
    },
  });
}
