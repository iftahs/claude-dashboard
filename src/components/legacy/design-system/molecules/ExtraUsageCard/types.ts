// Provider-neutral shape built by claudeExtraUsageView / codexCreditsView (./utils) for one shared card.
export interface ExtraUsageView {
  title: string;
  help: string;
  /** Pay-beyond-the-plan is on: show the usage row; otherwise `disabledCopy`. */
  enabled: boolean;
  /** Headline row while enabled. `pct` null draws no bar (e.g. a balance with no limit). */
  usage?: { label: string; value: string; limit: string | null; pct: number | null };
  disabledCopy?: string;
  /** Extra key/value rows under the headline (e.g. reset credits). */
  rows?: { label: string; value: string; tone?: 'danger' }[];
  /** Footnote, with an optional trailing link. */
  disclaimer?: { text: string; linkText: string | null; href: string | null };
}

export interface ExtraUsageCardProps {
  view: ExtraUsageView;
}
