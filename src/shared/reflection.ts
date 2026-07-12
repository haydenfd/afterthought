export type OpeningQuestions = [string, string];

export const reflectionStrategies = [
  'deepen-current-thought',
  'revisit-unresolved-thread',
  'connect-recurring-experiences',
  'explore-changed-belief',
  'notice-progress',
  'surface-contradiction',
  'examine-avoidance',
  'connect-behavior-and-effect',
  'ask-for-example',
] as const;

export type ReflectionStrategy = (typeof reflectionStrategies)[number];

export type ReflectionProvenance = {
  strategy: ReflectionStrategy;
  sourceMemoryIds: string[];
};

export type OpeningQuestionsBundle = {
  questions: OpeningQuestions;
  generatedAt: string;
};

export type OpeningQuestionsResult = {
  questions: OpeningQuestions | null;
  source: 'ai' | 'fallback';
};

export type DeeperQuestionInput = {
  openingQuestions: OpeningQuestions;
  initialResponse: string;
};

export type DeeperQuestionResult = {
  question: string;
  themes: string[];
  source: 'ai' | 'fallback';
  provenance: ReflectionProvenance;
};
