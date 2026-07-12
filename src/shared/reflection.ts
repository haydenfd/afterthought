export type OpeningQuestions = [string, string];

/**
 * A follow-up on an unresolved thread from a recent entry — an experiment the
 * person started, a decision they were sitting with, a worry they raised. This
 * is what makes the app feel like it remembers across sessions.
 */
export type OpeningCallback = {
  /** A short, calm lead-in shown above the question, e.g. "A few days ago…". */
  label: string;
  /** The gentle follow-up question that picks the thread back up. */
  question: string;
};

export type OpeningQuestionsBundle = {
  questions: OpeningQuestions;
  callback?: OpeningCallback;
  generatedAt: string;
};

export type OpeningQuestionsResult = {
  questions: OpeningQuestions | null;
  callback?: OpeningCallback;
  source: 'ai' | 'fallback';
};
