export type StatusDotTone = 'success' | 'warning' | 'danger' | 'info' | 'accent' | 'neutral';

export type StatusDotSize = 'sm' | 'md';

export interface StatusDotProps {
  tone?: StatusDotTone;
  size?: StatusDotSize;
  pulse?: boolean;
  label?: string;
  className?: string;
}
