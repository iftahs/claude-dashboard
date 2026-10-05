import { Card } from '@/components/design-system/atoms/Card/Card';
import { SkeletonPreset } from '@/components/design-system/molecules/SkeletonPreset/SkeletonPreset';
import { PageLayout } from '@/components/design-system/templates/PageLayout/PageLayout';

export function PageFallback() {
  return (
    <PageLayout>
      <Card as="div">
        <SkeletonPreset variant="text" />
      </Card>
      <Card as="div">
        <SkeletonPreset variant="chart" />
      </Card>
    </PageLayout>
  );
}
