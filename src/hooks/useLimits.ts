import { useState } from 'react';

export interface Limits {
  blockLimit: number | null;   // effectiveTokens cap per 5h block (null = not configured)
  weeklyLimit: number | null;  // effectiveTokens cap per week (null = not configured)
}

const KEY = 'claude-dashboard-limits';

function load(): Limits {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? 'null') ?? { blockLimit: null, weeklyLimit: null };
  } catch {
    return { blockLimit: null, weeklyLimit: null };
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
