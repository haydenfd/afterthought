import { type ReactNode } from 'react';

import { DraftProvider } from '@/state/draft-context';
import { SupermemoryProvider } from '@/state/supermemory-context';
import { ThemeProvider } from '@/state/theme-context';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <SupermemoryProvider>
        <DraftProvider>{children}</DraftProvider>
      </SupermemoryProvider>
    </ThemeProvider>
  );
}
