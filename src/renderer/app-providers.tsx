import { type ReactNode } from 'react';

import { SupermemoryProvider } from '@/state/supermemory-context';
import { ThemeProvider } from '@/state/theme-context';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <SupermemoryProvider>{children}</SupermemoryProvider>
    </ThemeProvider>
  );
}
