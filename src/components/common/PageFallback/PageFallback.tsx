import { Card } from '@/components/design-system/atoms/Card/Card';
import { Skeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
import { SkeletonPreset } from '@/components/design-system/molecules/SkeletonPreset/SkeletonPreset';
import { PageLayout } from '@/components/design-system/templates/PageLayout/PageLayout';

export function PageFallback() {
  return (
    <PageLayout header={<Skeleton className="my-1.5 h-5 w-64 max-w-full" />}>
      <Card as="div">
        <SkeletonPreset variant="text" />
      </Card>
      <Card as="div">
        <SkeletonPreset variant="chart" />
      </Card>
    </PageLayout>
  );
}
