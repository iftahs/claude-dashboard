/** One segment of the split bar — a surface (Code / Cowork / Codex) or a Codex thread kind. */
export interface SplitSegment {
  key: string;
  label: string;
  color: string;
  effectiveTokens: number;
  cost: number;
  /** Share of the bar, 0–100. */
  pct: number;
}

export interface SourcesSplitChartProps {
  /** Segments in display order (build them with computeSourceSplit / computeCodexSplit). */
  segments: SplitSegment[];
  weekDays: number;
  /** Platform-aware explanation (see sourcesHelp). */
  help: string;
  /** Platform suffix for the title (`titleScope(platform)`); '' under Claude. */
  scope?: string;
}
