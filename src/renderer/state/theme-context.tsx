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
  const [appearance, setAppearanceState] = useState<Appearance>('system');

  const setAppearance = useCallback((next: Appearance): void => {
    setAppearanceState(next);
    void window.afterthought.preferences.set({ appearance: next });
  }, []);

  useEffect(() => {
    let isCurrent = true;

    void window.afterthought.preferences.get().then((preferences) => {
      if (isCurrent && preferences.appearance) {
        setAppearanceState(preferences.appearance);
      }
    });

    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = (): void => {
      const resolvedAppearance =
        appearance === 'system' ? (mediaQuery.matches ? 'dark' : 'light') : appearance;

      const root = document.documentElement;
      root.classList.add('theme-switching');
      root.classList.toggle('dark', resolvedAppearance === 'dark');
      root.style.colorScheme = resolvedAppearance;

      window.requestAnimationFrame(() => {
        root.classList.remove('theme-switching');
      });
    };

    applyTheme();
    mediaQuery.addEventListener('change', applyTheme);

    return () => {
      mediaQuery.removeEventListener('change', applyTheme);
    };
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
