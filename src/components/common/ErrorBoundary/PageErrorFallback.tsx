import { Card } from '@/components/design-system/atoms/Card/Card';
import { ErrorState } from '@/components/design-system/molecules/ErrorState/ErrorState';
import { PageLayout } from '@/components/design-system/templates/PageLayout/PageLayout';
import type { ErrorFallbackProps } from './types';
import { PAGE_ERROR_TITLE, RELOAD_HINT, RELOAD_LABEL, reloadPage } from './utils';

export function PageErrorFallback({ error }: ErrorFallbackProps) {
  return (
    <PageLayout>
      <Card as="div">
        <ErrorState
          title={PAGE_ERROR_TITLE}
          description={RELOAD_HINT}
          detail={String(error)}
          onRetry={reloadPage}
          retryLabel={RELOAD_LABEL}
        />
      </Card>
    </PageLayout>
  );
}
