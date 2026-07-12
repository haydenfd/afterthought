export type OpeningQuestions = [string, string];

export type OpeningQuestionsBundle = {
  questions: OpeningQuestions;
  generatedAt: string;
};

export type OpeningQuestionsResult = {
  questions: OpeningQuestions | null;
  source: 'ai' | 'fallback';
};
