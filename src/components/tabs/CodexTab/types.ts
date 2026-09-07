/** One StatCard's worth of Codex data, built by the utils and rendered by the tab. */
export interface CodexStat {
  key: string;
  label: string;
  value: string;
  sub?: string;
  help?: string;
  /** Value colour override (e.g. red when the plan limit is reached). */
  accent?: string;
}
