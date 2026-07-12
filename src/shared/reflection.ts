export type OpeningQuestionsBundle = {
  primaryQuestion: string;
  alternateQuestion: string;
  reason: string;
  sourceMemoryIds: string[];
  generatedAt: string;
};

export type OpeningQuestionsResult = {
  primaryQuestion: string | null;
  source: 'ai' | 'fallback';
};
