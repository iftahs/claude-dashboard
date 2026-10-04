import type { ReactNode } from 'react';

export interface SectionProps {
  title: string;
  children: ReactNode;
  right?: ReactNode;
  className?: string;
  grow?: boolean;
  /** Optional hover explanation shown via a "?" badge next to the title. */
  help?: ReactNode;
  /** Opt this section into AI insights: section key (also used for analytics). */
  aiSection?: string;
  /** Click handler for the AI button (App owns the section→data mapping). */
  onAiInsight?: () => void;
  /** True while the AI request for this section is in flight. */
  aiLoading?: boolean;
  /** Hide the AI button (e.g. no AI backend available). */
  aiDisabled?: boolean;
  /** The rendered AI result (AiInsightInline), shown below the content. */
  aiInsight?: ReactNode;
}
