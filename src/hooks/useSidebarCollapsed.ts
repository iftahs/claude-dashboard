import { useCallback, useState } from 'react';

const KEY = 'claude-dashboard-sidebar-collapsed';

function load(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function useSidebarCollapsed(): { collapsed: boolean; toggle: () => void } {
  const [collapsed, setCollapsed] = useState(load);

  const toggle = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(KEY, next ? '1' : '0');
      } catch {
        // Storage can be blocked; the choice still holds for this page load.
      }
      return next;
    });
  }, []);

  return { collapsed, toggle };
}
