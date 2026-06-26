import type { VariantProps } from 'class-variance-authority';
import type { sidebarBadgeVariants } from './SidebarBadge.variants';

export type SidebarBadgeTone = NonNullable<VariantProps<typeof sidebarBadgeVariants>['tone']>;

export interface SidebarBadgeProps {
  tone: SidebarBadgeTone;
  /** Chip contents — a count or a "42%" string. */
  label: string | number;
  /** Native tooltip text. */
  title?: string;
  /** Render a pulsing live dot before the label. */
  pulse?: boolean;
}
