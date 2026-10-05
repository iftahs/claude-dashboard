import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { ExportSource } from '@/lib/export';

type RegisterExport = (source: ExportSource) => () => void;

const NO_PROVIDER: RegisterExport = () => () => undefined;

const RegisterExportContext = createContext<RegisterExport>(NO_PROVIDER);
const PageExportContext = createContext<ExportSource | null>(null);

export function PageActionsProvider({ children }: { children: ReactNode }) {
  const [source, setSource] = useState<ExportSource | null>(null);

  const register = useCallback<RegisterExport>((next) => {
    setSource(() => next);
    // A page that mounts before the previous one unmounts must not be cleared by the late cleanup.
    return () => setSource((current) => (current === next ? null : current));
  }, []);

  return (
    <RegisterExportContext.Provider value={register}>
      <PageExportContext.Provider value={source}>{children}</PageExportContext.Provider>
    </RegisterExportContext.Provider>
  );
}

export function useRegisterPageExport(getData: ExportSource | null): void {
  const register = useContext(RegisterExportContext);
  const latest = useRef(getData);
  const active = getData !== null;

  useEffect(() => {
    latest.current = getData;
  }, [getData]);

  // Registered once per mount: the ref keeps an unmemoised getter from re-registering on every render.
  useEffect(() => {
    if (!active) return undefined;
    return register(() => latest.current?.() ?? null);
  }, [active, register]);
}

export function usePageExport(): ExportSource | null {
  return useContext(PageExportContext);
}
