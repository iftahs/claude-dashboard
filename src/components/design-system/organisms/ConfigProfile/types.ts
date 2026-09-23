import type { BadgeProps } from '@/components/design-system/atoms/Badge/types';

export type ProfileTone = 'clay' | 'emerald' | 'cyan' | 'indigo' | 'amber' | 'violet';

export interface ProfileTile {
  label: string;
  value: string;
  /** Hover text; defaults to the value. */
  title?: string;
  tone: ProfileTone;
  /** Capitalise the value (settings values are lower-case identifiers). */
  capitalize?: boolean;
}

export interface ProfileFlag {
  label: string;
  value: string;
  variant: NonNullable<BadgeProps['variant']>;
}

export interface ProfileList {
  title: string;
  /** Shown in the title's "(n)"; defaults to items.length. */
  count?: number;
  items: string[];
  empty: string;
}

// Claude and Codex profiles fill the same slots (claudeProfileView / codexProfileView in utils.ts), so both platforms get the same card and layout.
export interface ConfigProfileView {
  title: string;
  help: string;
  subtitle: string;
  tiles: ProfileTile[];
  flags: ProfileFlag[];
  counts: { label: string; value: number }[];
  lists: ProfileList[];
}

export interface ConfigProfileProps {
  /** The profile to show; null while it loads (renders a skeleton card). */
  profile: ConfigProfileView | null;
}
