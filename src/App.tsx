import { lazy, Suspense, useMemo } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/common/AppShell/AppShell';
import { useSource } from '@/hooks/useSource';
import { DEFAULT_ROUTE, routesFor } from '@/routes';

const DesignSystemPage = import.meta.env.DEV
  ? lazy(() => import('./pages/DesignSystemPage/DesignSystemPage').then((m) => ({ default: m.DesignSystemPage })))
  : null;

export default function App() {
  const { platform } = useSource();
  // A page the platform hides is not registered, so its path falls through to `*` like any unknown one.
  const routes = useMemo(() => routesFor(platform), [platform]);

  return (
    <Routes>
      {DesignSystemPage ? (
        <Route
          path="/__ds"
          element={
            <Suspense fallback={null}>
              <DesignSystemPage />
            </Suspense>
          }
        />
      ) : null}
      <Route element={<AppShell />}>
        <Route index element={DEFAULT_ROUTE.element} />
        {routes.map((route) => (
          <Route key={route.id} id={route.id} path={route.path} element={route.element} />
        ))}
        <Route path="*" element={DEFAULT_ROUTE.element} />
      </Route>
    </Routes>
  );
}
