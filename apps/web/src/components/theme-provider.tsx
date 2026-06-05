'use client';
/* IC Clínica — Provider de tema (claro/escuro), persistido em localStorage. */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeCtx {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');

  // sincroniza com o que o script inline já aplicou (evita flash)
  useEffect(() => {
    const initial = (document.documentElement.getAttribute('data-theme') as Theme) || 'light';
    setTheme(initial);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('ic_theme', theme);
    } catch {
      /* noop */
    }
  }, [theme]);

  const toggle = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  return <Ctx.Provider value={{ theme, setTheme, toggle }}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const c = useContext(Ctx);
  if (!c) return { theme: 'light', setTheme: () => {}, toggle: () => {} };
  return c;
}

/** Script inserido no <head> para aplicar tema/densidade antes da pintura. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('ic_theme')||'light';document.documentElement.setAttribute('data-theme',t);document.documentElement.setAttribute('data-density','regular');}catch(e){document.documentElement.setAttribute('data-theme','light');}})();`;
