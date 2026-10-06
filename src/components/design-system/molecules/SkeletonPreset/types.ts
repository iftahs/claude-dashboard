export type SkeletonPresetVariant = 'text' | 'stat' | 'chart' | 'bars' | 'table' | 'gauge';

export interface SkeletonPresetProps {
  variant: SkeletonPresetVariant;
  rows?: number;
  height?: number;
  className?: string;
}
