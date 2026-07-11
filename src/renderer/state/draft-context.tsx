import { createContext, type ReactNode, useContext, useMemo, useState } from 'react';

interface DraftState {
  draft: string;
  setDraft: (value: string) => void;
  isFinished: boolean;
  finishEntry: () => void;
  returnToEditing: () => void;
}

const DraftContext = createContext<DraftState | null>(null);

export function DraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState('');
  const [isFinished, setIsFinished] = useState(false);

  const value = useMemo<DraftState>(
    () => ({
      draft,
      setDraft,
      isFinished,
      finishEntry: () => setIsFinished(true),
      returnToEditing: () => setIsFinished(false),
    }),
    [draft, isFinished],
  );

  return <DraftContext.Provider value={value}>{children}</DraftContext.Provider>;
}

export function useDraft(): DraftState {
  const context = useContext(DraftContext);

  if (!context) {
    throw new Error('useDraft must be used within DraftProvider');
  }

  return context;
}
