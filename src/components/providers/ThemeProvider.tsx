'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'houseiana.theme';

type ThemeContextValue = {
  preference: ThemePreference;
  resolved: 'light' | 'dark';
  setPreference: (next: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Runs before paint (see `themeScript`) and then keeps `data-theme` in sync.
 * The attribute is always a concrete "light" or "dark" so every CSS token has
 * exactly one authoritative value.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [resolved, setResolved] = useState<'light' | 'dark'>('light');

  const apply = useCallback((next: ThemePreference) => {
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const effective = next === 'system' ? (systemDark ? 'dark' : 'light') : next;
    document.documentElement.dataset.theme = effective;
    setResolved(effective);
  }, []);

  // The inline `themeScript` has already stamped data-theme before paint; this
  // effect only catches the provider's state up so the toggle shows the right
  // selection. localStorage cannot be read during render (no server equivalent).
  useEffect(() => {
    const stored = (window.localStorage.getItem(STORAGE_KEY) as ThemePreference | null) ?? 'system';
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreferenceState(stored);
    apply(stored);

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      if ((window.localStorage.getItem(STORAGE_KEY) ?? 'system') === 'system') apply('system');
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [apply]);

  const setPreference = useCallback(
    (next: ThemePreference) => {
      window.localStorage.setItem(STORAGE_KEY, next);
      setPreferenceState(next);
      apply(next);
    },
    [apply],
  );

  return (
    <ThemeContext.Provider value={{ preference, resolved, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}

/** Inlined in <head> so the first paint already has the right palette. */
export const themeScript = `(function(){try{var p=localStorage.getItem('${STORAGE_KEY}')||'system';var d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){}})();`;
