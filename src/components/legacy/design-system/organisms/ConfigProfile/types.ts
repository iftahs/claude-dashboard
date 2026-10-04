import type { ConfigProfileView } from '@/lib/views/workspace';

export interface ConfigProfileProps {
  /** The profile to show; null while it loads (renders a skeleton card). */
  profile: ConfigProfileView | null;
}
