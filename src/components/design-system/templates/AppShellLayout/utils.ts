import type { KeyboardEvent } from 'react';

export const MAIN_CONTENT_ID = 'main-content';

const TABBABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function keepTabInside(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== 'Tab') return;
  const container = event.currentTarget;
  const tabbable = Array.from(container.querySelectorAll<HTMLElement>(TABBABLE_SELECTOR)).filter(
    (element) => element.getClientRects().length > 0,
  );
  const first = tabbable[0];
  const last = tabbable[tabbable.length - 1];
  if (!first || !last) {
    event.preventDefault();
    return;
  }
  const active = document.activeElement;
  if (event.shiftKey && (active === first || active === container)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

export const DRAWER_EXIT_FALLBACK_MS = 300;
