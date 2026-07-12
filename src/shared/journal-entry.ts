export type JournalEntry = {
  id: string;
  createdAt: string;
  updatedAt: string;
  prompt: string;
  content: string;
  title?: string;
};

export type CreateJournalEntryInput = {
  prompt: string;
  content: string;
  title?: string;
};
