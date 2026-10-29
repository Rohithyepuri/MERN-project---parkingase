import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'parkease.theme';

function resolve(theme) {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => localStorage.getItem(STORAGE_KEY) || 'system');

  const apply = useCallback((next) => {
    const resolved = resolve(next);
    document.documentElement.classList.toggle('dark', resolved === 'dark');
    document.documentElement.style.colorScheme = resolved;
  }, []);

  useEffect(() => {
    apply(theme);
    if (theme !== 'system') return undefined;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = () => apply('system');
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [theme, apply]);

  const setTheme = useCallback(
    (next) => {
      localStorage.setItem(STORAGE_KEY, next);
      setThemeState(next);
    },
    []
  );

  const toggle = useCallback(() => {
    const resolved = resolve(theme);
    setTheme(resolved === 'dark' ? 'light' : 'dark');
  }, [theme, setTheme]);

  const value = useMemo(() => ({ theme, resolved: resolve(theme), setTheme, toggle }), [theme, setTheme, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
