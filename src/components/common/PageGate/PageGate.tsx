import { Card } from '@/components/design-system/atoms/Card/Card';
import { Callout } from '@/components/design-system/molecules/Callout/Callout';
import { EmptyState } from '@/components/design-system/molecules/EmptyState/EmptyState';
import { ErrorState } from '@/components/design-system/molecules/ErrorState/ErrorState';
import { PageLayout } from '@/components/design-system/templates/PageLayout/PageLayout';
import { usePageGate } from '@/hooks/usePageGate';
import type { PageGateProps } from './types';
import { ERROR_TITLE, emptyCopy, errorDescription, liveOnlyCopy } from './utils';

export function PageGate({ routeId, children }: PageGateProps) {
  const gate = usePageGate(routeId);

  if (gate.state === 'error') {
    return (
      <PageLayout>
        <Card as="div">
          <ErrorState title={ERROR_TITLE} description={errorDescription(gate.message)} />
        </Card>
      </PageLayout>
    );
  }

  if (gate.state === 'empty') {
    const copy = emptyCopy(gate.platform);
    return (
      <PageLayout>
        <Card as="div">
          <EmptyState title={copy.title} description={copy.description} />
        </Card>
      </PageLayout>
    );
  }

  return (
    <>
      {gate.liveOnly ? (
        // Pages own their PageLayout, so the notice repeats its width and gutters to line up above it.
        <div className="mx-auto w-full max-w-content flex-none px-4 pt-6 lg:px-8">
          <Callout role="status">{liveOnlyCopy(gate.platform)}</Callout>
        </div>
      ) : null}
      {children}
    </>
  );
}
