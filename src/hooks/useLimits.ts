import { useState } from 'react';

export interface Limits {
  dailyLimit: number | null;   // USD cost cap per day (null = not configured)
  weeklyLimit: number | null;  // USD cost cap per week (null = not configured)
  monthlyLimit: number | null; // USD cost cap per month (null = not configured)
}

const KEY = 'claude-dashboard-limits-v2';

function load(): Limits {
  try {
    return (
      JSON.parse(localStorage.getItem(KEY) ?? 'null') ?? {
        dailyLimit: null,
        weeklyLimit: null,
        monthlyLimit: null,
      }
    );
  } catch {
    return { dailyLimit: null, weeklyLimit: null, monthlyLimit: null };
  }
}

export function useLimits(): [Limits, (l: Limits) => void] {
  const [limits, setLimitsState] = useState<Limits>(load);
  function setLimits(l: Limits) {
    setLimitsState(l);
    localStorage.setItem(KEY, JSON.stringify(l));
  }
  return [limits, setLimits];
}
