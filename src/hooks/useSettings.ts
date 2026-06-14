import { useState } from 'react';

/** UI-only preferences persisted client-side (never sent to the backend). */
export interface Settings {
  // 'auto' follows the backend-detected authMode; the others force a mode in case
  // auto-detection is ever wrong (e.g. an unusual auth setup).
  modeOverride: 'auto' | 'subscription' | 'api';
}

const KEY = 'claude-dashboard-settings-v1';

const DEFAULTS: Settings = { modeOverride: 'auto' };

function load(): Settings {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? 'null') ?? {}) };
  } catch {
    return DEFAULTS;
  }
}

export function useSettings(): [Settings, (s: Settings) => void] {
  const [settings, setSettingsState] = useState<Settings>(load);
  function setSettings(s: Settings) {
    setSettingsState(s);
    localStorage.setItem(KEY, JSON.stringify(s));
  }
  return [settings, setSettings];
}
