export type ProgressBarTone = 'accent' | 'warning' | 'danger' | 'success' | 'neutral' | 'codex';

export type ProgressBarSize = 'sm' | 'md' | 'lg';

export interface ProgressBarProps {
  value: number;
  tone?: ProgressBarTone;
  size?: ProgressBarSize;
  label?: string;
  className?: string;
}
