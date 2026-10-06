export type GroupedBarUnit = 'tokens' | 'cost';

export type GroupedBarDatum = Record<string, number | string | null>;

export interface GroupedBarSeries {
  key: string;
  label: string;
  color: string;
  value?: string;
}

export interface GroupedBarRow {
  label: string;
  title: string;
  footer?: string | null;
  values: Readonly<Record<string, number>>;
}

export interface GroupedBarChartProps {
  rows: readonly GroupedBarRow[];
  series: readonly GroupedBarSeries[];
  unit?: GroupedBarUnit;
  note?: string | null;
  height?: number;
  ariaLabel?: string;
  className?: string;
}
