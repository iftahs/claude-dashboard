export type SweepBarTone = 'accent' | 'success' | 'info' | 'neutral';

export interface SweepBarProps {
  tone?: SweepBarTone;
  label?: string;
  className?: string;
}
