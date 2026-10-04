import type { SplitSegment } from '@/lib/views/trends';

export interface SourcesSplitChartProps {
  /** Segments in display order (build them with computeSourceSplit / computeCodexSplit). */
  segments: SplitSegment[];
  weekDays: number;
  /** Platform-aware explanation (see sourcesHelp). */
  help: string;
  /** Platform suffix for the title (`titleScope(platform)`); '' under Claude. */
  scope?: string;
}
