export interface LegendDotProps {
  color: string;
  label: string;
  size?: 'sm' | 'md';
  /** Additional class(es) for the label span. Defaults to 'text-[11px] text-zinc-400'. */
  labelClassName?: string;
}
