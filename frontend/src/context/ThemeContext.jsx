import { createContext, useContext, useEffect, useState } from 'react';

const KEY = 'verimind_theme';
const ThemeContext = createContext({ preference: 'system', theme: 'dark', setPreference: () => {} });

const readPref = () => {
  try {
    return localStorage.getItem(KEY) || 'system';
  } catch {
    return 'system';
  }
};
const media = () => window.matchMedia('(prefers-color-scheme: dark)');

/** preference: 'light' | 'dark' | 'system'. theme: the resolved 'light' | 'dark'. */
export function ThemeProvider({ children }) {
  const [preference, setPref] = useState(readPref);
  const [systemDark, setSystemDark] = useState(() => media().matches);

  useEffect(() => {
    const m = media();
    const onChange = (e) => setSystemDark(e.matches);
    m.addEventListener('change', onChange);
    return () => m.removeEventListener('change', onChange);
  }, []);

  const theme = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const setPreference = (p) => {
    setPref(p);
    try {
      localStorage.setItem(KEY, p);
    } catch {
      /* storage unavailable: theme still applies for this session */
    }
  };

  return <ThemeContext.Provider value={{ preference, theme, setPreference }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
