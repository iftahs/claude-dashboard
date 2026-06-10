import { useRef, useEffect } from 'react';

const THRESHOLDS = [70, 90] as const;

/** Fires a browser Notification when the block % crosses 70% or 90%.
 *  Resets tracking when pct drops below 50% (new block started). */
export function useBlockAlerts(pct: number) {
  const lastAlerted = useRef<number>(0);
  const permissionRef = useRef<NotificationPermission>('default');

  useEffect(() => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().then((p) => {
        permissionRef.current = p;
      });
    } else {
      permissionRef.current = Notification.permission;
    }
  }, []);

  useEffect(() => {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    // New block started — reset threshold tracking
    if (pct < 50) {
      lastAlerted.current = 0;
      return;
    }

    for (const threshold of THRESHOLDS) {
      if (pct >= threshold && lastAlerted.current < threshold) {
        lastAlerted.current = threshold;
        new Notification(`Claude block at ${threshold}%`, {
          body:
            threshold === 90
              ? '⚠️ Block limit nearly reached — slow down to avoid hitting the cap.'
              : '🔔 You\'ve used 70% of your current 5-hour block.',
          icon: '/favicon.ico',
          tag: `claude-block-${threshold}`,
        });
        break; // Only fire one alert at a time
      }
    }
  }, [pct]);

  return {
    permission: typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'denied' as NotificationPermission,
  };
}
