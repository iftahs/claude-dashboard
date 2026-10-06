import type { ProgressBarTone } from '@/components/design-system/atoms/ProgressBar/types';

export type RankedMeterValueTone = 'default' | 'muted' | 'subtle' | 'success' | 'warning' | 'danger';

export type RankedMeterLabelWidth = 'sm' | 'md' | 'lg';

export interface RankedMeterRow {
  key?: string;
  label: string;
  title?: string;
  detail?: string;
  badge?: string;
  color?: string;
  percent: number;
  tone?: ProgressBarTone;
  value: string;
  valueTone?: RankedMeterValueTone;
  secondary?: string;
  secondaryTone?: RankedMeterValueTone;
}

export interface RankedMeterListProps {
  rows: readonly RankedMeterRow[];
  ariaLabel: string;
  tone?: ProgressBarTone;
  labelWidth?: RankedMeterLabelWidth;
  mono?: boolean;
  className?: string;
}
