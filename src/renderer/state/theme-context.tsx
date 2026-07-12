import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type Appearance = 'light' | 'dark' | 'system';

interface ThemeState {
  appearance: Appearance;
  setAppearance: (appearance: Appearance) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearance] = useState<Appearance>('system');

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
    [appearance],
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
