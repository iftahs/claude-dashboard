export type ThemeToggleTheme = 'dark' | 'light';

export interface ThemeToggleProps {
  theme: ThemeToggleTheme;
  onToggle: () => void;
  className?: string;
}
