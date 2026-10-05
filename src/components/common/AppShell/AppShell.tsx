import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { PageFallback } from '@/components/common/PageFallback/PageFallback';
import { PageGate } from '@/components/common/PageGate/PageGate';
import { CommandPalette } from '@/components/design-system/organisms/CommandPalette/CommandPalette';
import { Sidebar } from '@/components/design-system/organisms/Sidebar/Sidebar';
import { Topbar } from '@/components/design-system/organisms/Topbar/Topbar';
import { AppShellLayout } from '@/components/design-system/templates/AppShellLayout/AppShellLayout';
import { useAppShell } from '@/hooks/useAppShell';

export function AppShell() {
  const { routeId, layout, sidebar, topbar, palette } = useAppShell();

  return (
    <>
      <AppShellLayout {...layout} sidebar={<Sidebar {...sidebar} />} topbar={<Topbar {...topbar} />}>
        <Suspense fallback={<PageFallback />}>
          <PageGate routeId={routeId}>
            <Outlet />
          </PageGate>
        </Suspense>
      </AppShellLayout>
      <CommandPalette {...palette} />
    </>
  );
}
