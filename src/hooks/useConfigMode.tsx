import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { usePolling } from './usePolling';
import { useSettings } from './useSettings';
import type { Settings } from './useSettings';
import type { ClaudeConfig } from '../types';

type AuthMode = 'api' | 'subscription';

interface ConfigModeCtx {
  configData: ClaudeConfig | null;
  configLoading: boolean;
  /** Backend-detected auth mode (presence of a Claude.ai OAuth token). */
  detectedMode: AuthMode;
  /** Detected mode, unless the user forced one in Settings. */
  effectiveMode: AuthMode;
  isApi: boolean;
  litellmAvailable: boolean;
  litellmHost: string;
  settings: Settings;
  setSettings: (s: Settings) => void;
}

const ConfigModeContext = createContext<ConfigModeCtx | null>(null);

/**
 * Auth-mode resolution + LiteLLM gateway detection. API / pay-as-you-go mode
 * swaps the subscription-rate-limit framing for a cost view. Defaults to
 * subscription until config loads so the UI never flashes API mode for subscribers.
 */
export function ConfigModeProvider({ children }: { children: ReactNode }) {
  const config = usePolling<ClaudeConfig>('/api/config', 60000);
  const [settings, setSettings] = useSettings();

  const value = useMemo<ConfigModeCtx>(() => {
    const detectedMode: AuthMode = config.data?.authMode ?? 'subscription';
    const effectiveMode = settings.modeOverride === 'auto' ? detectedMode : settings.modeOverride;
    return {
      configData: config.data,
      configLoading: config.loading,
      detectedMode,
      effectiveMode,
      isApi: effectiveMode === 'api',
      litellmAvailable: !!config.data?.litellm?.available,
      litellmHost: config.data?.litellm?.gatewayHost ?? '',
      settings,
      setSettings,
    };
  }, [config.data, config.loading, settings, setSettings]);

  return <ConfigModeContext.Provider value={value}>{children}</ConfigModeContext.Provider>;
}

export function useConfigMode(): ConfigModeCtx {
  const ctx = useContext(ConfigModeContext);
  if (!ctx) throw new Error('useConfigMode must be used within a ConfigModeProvider');
  return ctx;
}
