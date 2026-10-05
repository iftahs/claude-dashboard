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
        <p className="text-caption text-fg-muted">
          Claude Code only — Codex records no workflow runs, so this page shows the Claude side.
        </p>
      ) : null}
      {typeof children === 'function' ? children({ limits }) : children}
    </PageLayout>
  );
}
