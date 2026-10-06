import { useEffect, useRef, useState } from 'react';
import type { AnimationEvent } from 'react';
import { cn } from '@/lib/cn';
import { appShellSidebarSlotVariants, appShellSidebarVariants } from './AppShellLayout.variants';
import type { AppShellLayoutProps } from './types';
import { DRAWER_EXIT_FALLBACK_MS, MAIN_CONTENT_ID, keepTabInside } from './utils';

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
  const [drawerMounted, setDrawerMounted] = useState(drawerOpen);
  if (drawerOpen && !drawerMounted) setDrawerMounted(true);
  const drawerClosing = drawerMounted && !drawerOpen;
  // The consumer switches the sidebar back to its column form the moment the drawer closes; the exit keeps the open one.
  const drawerSidebar = useRef(sidebar);
  if (drawerOpen) drawerSidebar.current = sidebar;

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

  useEffect(() => {
    if (!drawerClosing) return undefined;
    const panel = drawerRef.current;
    const exitAnimation = panel ? getComputedStyle(panel).animationName : 'none';
    if (!exitAnimation || exitAnimation === 'none') {
      setDrawerMounted(false);
      return undefined;
    }
    // A drawer hidden by the breakpoint never fires animationend.
    const timer = setTimeout(() => setDrawerMounted(false), DRAWER_EXIT_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [drawerClosing]);

  const onDrawerAnimationEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (drawerClosing && event.target === event.currentTarget) setDrawerMounted(false);
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas font-sans text-body tabular-nums text-fg">
      <a
        href={`#${MAIN_CONTENT_ID}`}
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-2 focus:z-50 focus:rounded-control focus:border focus:border-line focus:bg-surface-raised focus:px-3 focus:py-2 focus:text-small focus:font-medium focus:text-fg focus:shadow-pop focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-focus"
      >
        Skip to content
      </a>
      <aside className={appShellSidebarVariants({ collapsed: sidebarCollapsed })}>
        <div className={appShellSidebarSlotVariants({ collapsed: sidebarCollapsed })}>{sidebar}</div>
      </aside>
      <div className="relative flex min-w-0 flex-1 scroll-pt-topbar flex-col overflow-y-auto [scrollbar-gutter:stable]">
        <header className="sticky top-0 z-10 flex h-topbar flex-none items-center gap-3 border-b border-line bg-canvas px-4 lg:px-8">
          {topbar}
        </header>
        <main id={MAIN_CONTENT_ID} tabIndex={-1} className="flex min-w-0 flex-1 flex-col outline-none">
          {children}
        </main>
      </div>
      {drawerMounted ? (
        <div
          aria-hidden={drawerClosing || undefined}
          className={cn('fixed inset-0 z-40 lg:hidden', drawerClosing && 'pointer-events-none')}
        >
          <div
            aria-hidden="true"
            className={cn('absolute inset-0 bg-overlay', drawerClosing ? 'animate-fade-out' : 'animate-fade-in')}
            onClick={() => onDrawerClose?.()}
          />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label={drawerLabel}
            tabIndex={-1}
            onKeyDown={keepTabInside}
            onAnimationEnd={onDrawerAnimationEnd}
            className={cn(
              'absolute inset-y-0 left-0 flex w-sidebar max-w-full flex-col overflow-y-auto overflow-x-hidden overscroll-contain border-r border-line bg-surface shadow-pop outline-none',
              drawerClosing ? 'animate-slide-out-left' : 'animate-slide-in-left',
            )}
          >
            {drawerSidebar.current}
          </div>
        </div>
      ) : null}
    </div>
  );
}
