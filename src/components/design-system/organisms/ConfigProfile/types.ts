import type { BadgeProps } from '@/components/design-system/atoms/Badge/types';

/** Accent of a headline tile's value. */
export type ProfileTone = 'clay' | 'emerald' | 'cyan' | 'indigo' | 'amber' | 'violet';

/** One of the six headline tiles (model, effort, plan, …). */
export interface ProfileTile {
  label: string;
  value: string;
  /** Hover text; defaults to the value. */
  title?: string;
  tone: ProfileTone;
  /** Capitalise the value (settings values are lower-case identifiers). */
  capitalize?: boolean;
}

/** A label → badge row (on/off switches and short values). */
export interface ProfileFlag {
  label: string;
  value: string;
  variant: NonNullable<BadgeProps['variant']>;
}

/** A scrollable list (authorized workspaces, approved commands, …). */
export interface ProfileList {
  title: string;
  /** Shown in the title's "(n)"; defaults to items.length. */
  count?: number;
  items: string[];
  /** Shown in place of the items when there are none. */
  empty: string;
}

/**
 * Everything the card renders, platform-neutral: the Claude and Codex profiles
 * fill the same slots (see claudeProfileView / codexProfileView in utils.ts), so
 * both platforms get the same card and layout.
 */
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
