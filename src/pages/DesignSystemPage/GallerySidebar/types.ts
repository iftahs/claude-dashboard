import type { IconName } from '@/components/design-system/atoms/Icon/types';
import type { GallerySection, GallerySectionId } from '../types';

export interface GallerySidebarProps {
  sections: readonly GallerySection[];
  activeId: GallerySectionId;
  collapsed: boolean;
  toggleIcon: IconName;
  toggleLabel: string;
  onToggle: () => void;
  onNavigate: (id: GallerySectionId) => void;
}
