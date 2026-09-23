import type { ComplexityPoint } from '@/types';
import type { Platform } from '@/hooks/useSource';

export interface ComplexityScatterProps {
  data: ComplexityPoint[] | null;
  /** Decides what the dot size is called, and whether dots are coloured per platform (Both). */
  platform: Platform;
}

export interface TooltipPayloadItem {
  payload: ComplexityPoint;
}

export interface TooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  /** The dot-size row's label ("Subagents", "Guardian reviews", …). */
  sizeLabel: string;
  /** Add a platform row (the Both view mixes Claude and Codex sessions). */
  showPlatform: boolean;
}
