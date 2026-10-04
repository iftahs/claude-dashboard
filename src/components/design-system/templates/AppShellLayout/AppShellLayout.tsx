import { useEffect, useRef } from 'react';
import { appShellSidebarVariants } from './AppShellLayout.variants';
import type { AppShellLayoutProps } from './types';
import { MAIN_CONTENT_ID, keepTabInside } from './utils';

export function AppShellLayout({
  sidebar,
  topbar,
  children,
  sidebarCollapsed = false,
  drawerOpen = false,
  onDrawerClose,
  drawerLabel = 'Navigation',
}: AppShellLayoutProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const opener = document.activeElement;
    drawerRef.current?.focus();
    return () => {
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerOpen || !onDrawerClose) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) onDrawerClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [drawerOpen, onDrawerClose]);

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas font-sans text-body tabular-nums text-fg">
      <a
        href={`#${MAIN_CONTENT_ID}`}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-2 focus:z-50 focus:rounded-control focus:border focus:border-line focus:bg-surface-raised focus:px-3 focus:py-2 focus:text-small focus:font-medium focus:text-fg focus:shadow-pop focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-focus"
      >
        Skip to content
      </a>
      <aside className={appShellSidebarVariants({ collapsed: sidebarCollapsed })}>{sidebar}</aside>
      <div className="flex min-w-0 flex-1 scroll-pt-topbar flex-col overflow-y-auto">
        <header className="sticky top-0 z-10 flex h-topbar flex-none items-center gap-3 border-b border-line bg-canvas px-4 lg:px-8">
          {topbar}
        </header>
        <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex min-w-0 flex-1 flex-col outline-none">
          {children}
        </main>
      </div>
      {drawerOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div aria-hidden="true" className="absolute inset-0 bg-overlay" onClick={() => onDrawerClose?.()} />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label={drawerLabel}
            tabIndex={-1}
            onKeyDown={keepTabInside}
            className="absolute inset-y-0 left-0 flex w-sidebar max-w-full flex-col overflow-y-auto overflow-x-hidden overscroll-contain border-r border-line bg-surface shadow-pop outline-none"
          >
            {sidebar}
          </div>
        </div>
      ) : null}
    </div>
  );
}
