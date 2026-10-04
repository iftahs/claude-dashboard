import type { ComponentProps } from 'react';
import type { StatCard } from '@/components/legacy/design-system/atoms/StatCard/StatCard';
import type { WorkflowsData, WorkflowRun, WorkflowStats } from '@/types';

export type StatTileProps = ComponentProps<typeof StatCard>;

export interface WorkflowsViewProps {
  data: WorkflowsData | null;
  loading?: boolean;
  stats?: WorkflowStats | null;
  statsLoading?: boolean;
}

export interface WorkflowCardProps {
  run: WorkflowRun;
}
