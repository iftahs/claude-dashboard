import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { ErrorBoundary } from '@/components/common/ErrorBoundary/ErrorBoundary';
import { PageErrorFallback } from '@/components/common/ErrorBoundary/PageErrorFallback';
import { PageFallback } from '@/components/common/PageFallback/PageFallback';
import { PageGate } from '@/components/common/PageGate/PageGate';
import { CommandPalette } from '@/components/design-system/organisms/CommandPalette/CommandPalette';
import { Sidebar } from '@/components/design-system/organisms/Sidebar/Sidebar';
import { Topbar } from '@/components/design-system/organisms/Topbar/Topbar';
import { AppShellLayout } from '@/components/design-system/templates/AppShellLayout/AppShellLayout';
import { useAppShell } from '@/hooks/useAppShell';

export function AppShell() {
  const { routeId, layout, sidebar, topbar, palette } = useAppShell();
  const { key: locationKey } = useLocation();

  return (
    <>
      <AppShellLayout {...layout} sidebar={<Sidebar {...sidebar} />} topbar={<Topbar {...topbar} />}>
        {/* Any navigation retries: the route id covers a platform switch that changes the page under the same URL. */}
        <ErrorBoundary resetKey={`${routeId}:${locationKey}`} fallback={PageErrorFallback}>
          <Suspense fallback={<PageFallback />}>
            <PageGate routeId={routeId}>
              <Outlet />
            </PageGate>
          </Suspense>
        </ErrorBoundary>
      </AppShellLayout>
      <CommandPalette {...palette} />
    </>
  );
}
