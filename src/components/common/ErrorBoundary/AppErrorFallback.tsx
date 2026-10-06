import { Button } from '@/components/design-system/atoms/Button/Button';
import { APP_ERROR_TITLE, RELOAD_HINT, RELOAD_LABEL, reloadPage } from './utils';

// Rendered above every provider: plain markup and context-free atoms only.
export function AppErrorFallback() {
  return (
    <div
      role="alert"
      className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-canvas p-6 text-center font-sans text-fg"
    >
      <h1 className="text-title">{APP_ERROR_TITLE}</h1>
      <p className="max-w-sm text-body text-fg-muted">{RELOAD_HINT}</p>
      <Button variant="primary" className="mt-2" onClick={reloadPage}>
        {RELOAD_LABEL}
      </Button>
    </div>
  );
}
