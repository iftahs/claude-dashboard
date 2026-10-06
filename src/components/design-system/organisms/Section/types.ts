import type { ReactNode } from 'react';
import type { CardPadding } from '@/components/design-system/atoms/Card/types';
import type { CardHeaderElement } from '@/components/design-system/molecules/CardHeader/types';
import type { SectionAi, SectionState } from '@/lib/section';

export interface SectionProps {
  title: string;
  description?: ReactNode;
  help?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  as?: CardHeaderElement;
  grow?: boolean;
  padding?: CardPadding;
  className?: string;
  ai?: SectionAi | null;
  state?: SectionState | null;
}
