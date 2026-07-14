import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { NewEntryPage } from '@/routes/new-entry-page';
import { DraftProvider } from '@/state/draft-context';
import type {
  DeeperQuestionResult,
  MemoryEvidenceItem,
  OpeningQuestionsResult,
} from '../../../src/shared/reflection';

const initialAfterthoughtApi = window.afterthought;
const sourceMemory: MemoryEvidenceItem = {
  id: 'memory-one',
  text: 'Started a phone cutoff routine at 11pm.',
  similarity: 0.91,
  sourceDocumentIds: ['document-one'],
  sourceEntryIds: ['f408164b-4355-4da3-9c64-944d8f7129fb'],
};

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

  it('shows compact opening source context and saves it with the entry', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'entry-id' });
    setAfterthoughtApi(
      vi.fn().mockResolvedValue({
        questions: [
          'What changed when you kept the phone cutoff last night?',
          'What are you learning about protecting your mornings?',
        ],
        source: 'ai',
        sourceMemories: [sourceMemory],
      } satisfies OpeningQuestionsResult),
      create,
    );

    renderPage();

    expect(
      await screen.findByText('A thread you may be returning to'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Started a phone cutoff routine at 11pm.'),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Journal entry'), {
      target: { value: 'The cutoff changed my morning.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));

    await completeCloseAnimation();

    expect(create).toHaveBeenCalledWith({
      prompt: 'What changed when you kept the phone cutoff last night?',
      openingQuestions: [
        'What changed when you kept the phone cutoff last night?',
        'What are you learning about protecting your mornings?',
      ],
      content: 'The cutoff changed my morning.',
      openingContext: [sourceMemory],
    });
  });

  it('enables deeper reflection after a concise meaningful response', async () => {
    setAfterthoughtApi(
      vi.fn().mockResolvedValue({ questions: null, source: 'fallback' }),
    );

    renderPage();

    fireEvent.change(await screen.findByLabelText('Journal entry'), {
      target: { value: 'I finally called my dad today.' },
    });

    expect(screen.getByRole('button', { name: 'Go deeper' })).toBeEnabled();
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

    await completeCloseAnimation();

    expect(
      await screen.findByText('Your reflection has been saved.'),
    ).toBeInTheDocument();
    expect(create).toHaveBeenCalledWith({
      prompt: 'What has been taking up more space in your mind than you expected?',
      openingQuestions: [
        'What has been taking up more space in your mind than you expected?',
        'What are you noticing about the way you want to move through this season?',
      ],
      content: 'A thought worth keeping.',
    });
  });

  it('generates at most one deeper question after writing and saves the whole session', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'entry-id' });
    let resolveDeeper!: (result: DeeperQuestionResult) => void;
    const deeperQuestion = vi.fn().mockReturnValue(
      new Promise<DeeperQuestionResult>((resolve) => {
        resolveDeeper = resolve;
      }),
    );
    const openingQuestions = vi.fn().mockResolvedValue({
      questions: [
        'What changed in the routine you were testing?',
        'What are you learning about protecting your attention?',
      ],
      source: 'ai',
    } satisfies OpeningQuestionsResult);
    setAfterthoughtApi(openingQuestions, create, deeperQuestion);

    renderPage();

    const initialWriting =
      'The routine helped until uncertainty made every small interruption feel urgent.';
    fireEvent.change(await screen.findByLabelText('Journal entry'), {
      target: { value: initialWriting },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Go deeper' }));

    expect(deeperQuestion).toHaveBeenCalledTimes(1);
    expect(deeperQuestion).toHaveBeenCalledWith({
      openingQuestions: [
        'What changed in the routine you were testing?',
        'What are you learning about protecting your attention?',
      ],
      initialResponse: initialWriting,
    });
    expect(screen.getByLabelText('Journal entry')).toHaveAttribute('readonly');
    expect(screen.queryByLabelText('Deeper reflection')).not.toBeInTheDocument();

    await act(() =>
      Promise.resolve(
        resolveDeeper({
          question:
            'What makes an interruption feel more certain than the work beside it?',
          themes: ['attention', 'uncertainty'],
          source: 'ai',
          provenance: {
            strategy: 'connect-behavior-and-effect',
            sourceMemoryIds: ['memory-one'],
            sourceMemories: [sourceMemory],
          },
        }),
      ),
    );

    expect(screen.queryByRole('button', { name: 'Go deeper' })).not.toBeInTheDocument();
    expect(screen.getByText('This question is connected to')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Deeper reflection'), {
      target: {
        value: 'It offers a quick answer when the larger work still feels open.',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));

    await completeCloseAnimation();

    expect(
      await screen.findByText('Your reflection has been saved.'),
    ).toBeInTheDocument();
    expect(create).toHaveBeenCalledWith({
      prompt: 'What changed in the routine you were testing?',
      openingQuestions: [
        'What changed in the routine you were testing?',
        'What are you learning about protecting your attention?',
      ],
      content: initialWriting,
      deeperReflection: {
        question:
          'What makes an interruption feel more certain than the work beside it?',
        response: 'It offers a quick answer when the larger work still feels open.',
        provenance: {
          strategy: 'connect-behavior-and-effect',
          sourceMemoryIds: ['memory-one'],
          sourceMemories: [sourceMemory],
        },
      },
      themes: ['attention', 'uncertainty'],
    });
  });
});

async function completeCloseAnimation(): Promise<void> {
  const page = screen.getByTestId('reflection-page');
  await waitFor(() => expect(page).toHaveClass('reflection-page--closing'));
  fireEvent.animationEnd(page, { animationName: 'reflection-page-crumple' });
  await waitFor(
    () => expect(screen.getByText('That page is closed.')).toBeInTheDocument(),
    { timeout: 1700 },
  );
}

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
  deeperQuestion = vi.fn(),
): void {
  Object.defineProperty(window, 'afterthought', {
    configurable: true,
    value: {
      entries: { create, get: vi.fn(), list: vi.fn().mockResolvedValue([]) },
      reflection: { openingQuestions, deeperQuestion },
    },
  });
}
