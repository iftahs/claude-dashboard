import type { CSSProperties } from 'react';

export interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
}

export interface ChartSkeletonProps {
  heightClass?: string;
}

export interface BarsSkeletonProps {
  rows?: number;
}

export interface HeatmapSkeletonProps {
  weeks?: number;
}
