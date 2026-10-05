import type { BadgeTone } from '@/components/design-system/atoms/Badge/types';
import type { CalloutTone } from '@/components/design-system/molecules/Callout/types';
import type { IconName } from '@/components/design-system/atoms/Icon/types';
import type { KeyValueRowTone } from '@/components/design-system/molecules/KeyValueRow/types';
import type { ProgressBarTone } from '@/components/design-system/atoms/ProgressBar/types';
import type { StatusDotTone } from '@/components/design-system/atoms/StatusDot/types';
import type { DropdownMenuItemTone } from '@/components/design-system/molecules/DropdownMenu/types';
import type { SkeletonPresetVariant } from '@/components/design-system/molecules/SkeletonPreset/types';
import type { StatTileTone } from '@/components/design-system/molecules/StatTile/types';
import type { ToastTone } from '@/components/design-system/molecules/Toast/types';

export type GallerySectionId = 'atoms' | 'molecules' | 'organisms' | 'templates';

export interface GallerySection {
  id: GallerySectionId;
  label: string;
  icon: IconName;
  count: number;
  description: string;
}

export type PlatformValue = 'claude' | 'codex' | 'both';

export type RangeValue = '7d' | '30d' | '90d' | '1y';

export type InsightView = 'reliability' | 'tools' | 'code' | 'pace';

export type AgentFilter = 'running' | 'finished' | 'failed';

export interface ModelSample {
  id: string;
  label: string;
}

export interface BadgeSample {
  label: string;
  tone: BadgeTone;
  icon?: IconName;
}

export interface StatusSample {
  label: string;
  tone: StatusDotTone;
  pulse: boolean;
}

export interface MeterSample {
  label: string;
  value: string;
  percent: number;
  tone: ProgressBarTone;
  note: string;
}

export interface StatSample {
  label: string;
  value: string;
  sub?: string;
  tone?: StatTileTone;
  help?: string;
}

export interface SessionSample {
  key: string;
  title: string;
  model: ModelSample;
  tokens: string;
  cost: string;
  when: string;
}

export interface MenuActionSample {
  key: string;
  label: string;
  icon?: IconName;
  tone?: DropdownMenuItemTone;
  disabled?: boolean;
}

export interface ToastSample {
  tone: ToastTone;
  title: string;
  description: string;
}

export interface SkeletonSample {
  variant: SkeletonPresetVariant;
  rows?: number;
}

export interface KeyValueSample {
  label: string;
  value: string;
  help?: string;
  tone?: KeyValueRowTone;
}

export interface CalloutSample {
  tone: CalloutTone;
  title?: string;
  body: string;
}

export type AskState = 'idle' | 'loading' | 'done';
