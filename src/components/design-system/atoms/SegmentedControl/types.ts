export type SegmentedControlSize = 'md' | 'sm';

export interface SegmentedControlOption<T extends string = string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string = string> {
  options: readonly SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  size?: SegmentedControlSize;
  className?: string;
}

export interface SegmentedControlThumb {
  left: number;
  width: number;
}
