export type Theme = 'light' | 'dark';

interface ThemeEnvironment {
  getStoredTheme: () => string | null;
  prefersDark: () => boolean;
}

export const resolveInitialTheme = ({ getStoredTheme, prefersDark }: ThemeEnvironment): Theme => {
  const storedTheme = getStoredTheme();
  if (storedTheme === 'dark' || storedTheme === 'light') return storedTheme;
  return prefersDark() ? 'dark' : 'light';
};

export const getInitialTheme = (): Theme =>
  resolveInitialTheme({
    getStoredTheme: () => localStorage.getItem('theme'),
    prefersDark: () => typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-color-scheme: dark)').matches,
  });

export const applyTheme = (theme: Theme) => {
  document.documentElement.classList.toggle('dark', theme === 'dark');
};
