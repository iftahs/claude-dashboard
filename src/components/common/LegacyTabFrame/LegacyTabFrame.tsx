import { Callout } from '@/components/design-system/molecules/Callout/Callout';
import { PageLayout } from '@/components/design-system/templates/PageLayout/PageLayout';
import { useLimits } from '@/hooks/useLimits';
import { useSource } from '@/hooks/useSource';
import type { LegacyTabFrameProps } from './types';

export function LegacyTabFrame({ routeId, children }: LegacyTabFrameProps) {
  const limits = useLimits();
  const { platform } = useSource();

  return (
    <PageLayout>
      {routeId === 'workflows' && platform === 'both' ? (
        <Callout tone="neutral">Claude Code only — Codex records no workflow runs, so this page shows the Claude side.</Callout>
      ) : null}
      {typeof children === 'function' ? children({ limits }) : children}
    </PageLayout>
  );
}
