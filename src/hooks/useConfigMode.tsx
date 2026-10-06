import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { usePolling } from './usePolling';
import { useSettings } from './useSettings';
import type { Settings } from './useSettings';
import { localeDefaultWeekStart } from '../lib/week';
import type { WeekStart } from '../lib/week';
import type { ClaudeConfig } from '../types';

type AuthMode = 'api' | 'subscription';

interface ConfigModeCtx {
  configData: ClaudeConfig | null;
  configLoading: boolean;
  /** The auth mode is known: /api/config answered, or an earlier session remembered it. */
  modeKnown: boolean;
  /** Backend-detected auth mode (presence of a Claude.ai OAuth token). */
  detectedMode: AuthMode;
  /** Detected mode, unless the user forced one in Settings. */
  effectiveMode: AuthMode;
  isApi: boolean;
  litellmAvailable: boolean;
  litellmHost: string;
  /** First day of the week, resolved from settings ('auto' → browser locale). */
  weekStart: WeekStart;
  settings: Settings;
  setSettings: (s: Settings) => void;
}

const ConfigModeContext = createContext<ConfigModeCtx | null>(null);

const MODE_HINT_KEY = 'claude-dashboard-auth-mode-hint';

function loadModeHint(): AuthMode | null {
  try {
    const v = localStorage.getItem(MODE_HINT_KEY);
    return v === 'api' || v === 'subscription' ? v : null;
  } catch {
    return null;
  }
}

/**
 * Auth-mode resolution + LiteLLM gateway detection. API / pay-as-you-go mode
 * swaps the subscription-rate-limit framing for a cost view. Defaults to
 * subscription until config loads so the UI never flashes API mode for subscribers.
 */
export function ConfigModeProvider({ children }: { children: ReactNode }) {
  const config = usePolling<ClaudeConfig>('/api/config', 60000);
  const [settings, setSettings] = useSettings();
  // The last detected mode, so mode-gated sections are laid out on the first paint instead of popping in.
  const [modeHint] = useState(loadModeHint);
  const liveMode = config.data?.authMode;

  useEffect(() => {
    if (!liveMode) return;
    try { localStorage.setItem(MODE_HINT_KEY, liveMode); } catch { /* private mode */ }
  }, [liveMode]);

  const value = useMemo<ConfigModeCtx>(() => {
    const detectedMode: AuthMode = config.data?.authMode ?? modeHint ?? 'subscription';
    const effectiveMode = settings.modeOverride === 'auto' ? detectedMode : settings.modeOverride;
    return {
      configData: config.data,
      configLoading: config.loading,
      modeKnown: !!config.data || modeHint !== null,
      detectedMode,
      effectiveMode,
      isApi: effectiveMode === 'api',
      litellmAvailable: !!config.data?.litellm?.available,
      litellmHost: config.data?.litellm?.gatewayHost ?? '',
      weekStart: settings.weekStartDay === 'auto' ? localeDefaultWeekStart() : settings.weekStartDay,
      settings,
      setSettings,
    };
  }, [config.data, config.loading, modeHint, settings, setSettings]);

  return <ConfigModeContext.Provider value={value}>{children}</ConfigModeContext.Provider>;
}

export function useConfigMode(): ConfigModeCtx {
  const ctx = useContext(ConfigModeContext);
  if (!ctx) throw new Error('useConfigMode must be used within a ConfigModeProvider');
  return ctx;
}
