import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { Appearance } from '../../shared/preferences';

export type { Appearance };

interface ThemeState {
  appearance: Appearance;
  setAppearance: (appearance: Appearance) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearanceState] = useState<Appearance>('dark');

  const setAppearance = useCallback((next: Appearance): void => {
    setAppearanceState(next);
    void window.afterthought.preferences.set({ appearance: next });
  }, []);

  useEffect(() => {
    let isCurrent = true;

    void window.afterthought.preferences.get().then((preferences) => {
      if (!isCurrent) {
        return;
      }

      const nextAppearance: Appearance =
        preferences.appearance === 'light' ? 'light' : 'dark';
      setAppearanceState(nextAppearance);

      if (preferences.appearance !== nextAppearance) {
        void window.afterthought.preferences
          .set({ appearance: nextAppearance })
          .catch(() => {
            // Keep the dark default in memory if preferences cannot be persisted.
          });
      }
    });

    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    const applyTheme = (): void => {
      const root = document.documentElement;
      root.classList.add('theme-switching');
      root.classList.toggle('dark', appearance === 'dark');
      root.style.colorScheme = appearance;

      window.requestAnimationFrame(() => {
        root.classList.remove('theme-switching');
      });
    };

    applyTheme();
  }, [appearance]);

  const value = useMemo<ThemeState>(
    () => ({ appearance, setAppearance }),
    [appearance, setAppearance],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }

  return context;
}
