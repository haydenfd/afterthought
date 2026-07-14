import type {
  MemoryEvidenceItem,
  OpeningQuestions,
  ReflectionProvenance,
} from './reflection';

export type DeeperReflection = {
  question: string;
  response?: string;
  provenance?: ReflectionProvenance;
};

export type JournalEntry = {
  id: string;
  createdAt: string;
  updatedAt: string;
  prompt: string;
  content: string;
  title?: string;
  openingQuestions?: OpeningQuestions;
  openingContext?: MemoryEvidenceItem[];
  deeperReflection?: DeeperReflection;
  themes?: string[];
};

export type CreateJournalEntryInput = {
  prompt: string;
  content: string;
  title?: string;
  openingQuestions?: OpeningQuestions;
  openingContext?: MemoryEvidenceItem[];
  deeperReflection?: DeeperReflection;
  themes?: string[];
};
