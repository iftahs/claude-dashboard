import { useState } from 'react';
import { parseDollar, fmt } from '@/components/design-system/molecules/LimitsPanel/utils';
import { PROVIDER_LABELS, PROVIDER_MODELS } from './useAiConfig';
import { NO_LIMITS, type CapPlatform, type Limits, type PlatformLimits } from './useLimits';
import type { AiConfig, AiProvider } from '../types';

interface Params {
  limits: PlatformLimits;
  onChangeLimits: (platform: CapPlatform, l: Limits | null) => void;
  aiConfig: AiConfig;
  onChangeAiConfig: (c: AiConfig) => void;
}

/** Draft inputs + save/clear for one platform's Daily / Weekly / Monthly caps. */
export interface CapDraft {
  dailyVal: string;
  setDailyVal: (v: string) => void;
  weeklyVal: string;
  setWeeklyVal: (v: string) => void;
  monthlyVal: string;
  setMonthlyVal: (v: string) => void;
  save: () => void;
  clear: () => void;
}

function useCapDraft(limits: Limits | null, onSave: (l: Limits | null) => void): CapDraft {
  const l = limits ?? NO_LIMITS;
  const [dailyVal, setDailyVal] = useState(fmt(l.dailyLimit));
  const [weeklyVal, setWeeklyVal] = useState(fmt(l.weeklyLimit));
  const [monthlyVal, setMonthlyVal] = useState(fmt(l.monthlyLimit));
  return {
    dailyVal,
    setDailyVal,
    weeklyVal,
    setWeeklyVal,
    monthlyVal,
    setMonthlyVal,
    save: () =>
      onSave({
        dailyLimit: parseDollar(dailyVal),
        weeklyLimit: parseDollar(weeklyVal),
        monthlyLimit: parseDollar(monthlyVal),
      }),
    clear: () => {
      onSave(null);
      setDailyVal('');
      setWeeklyVal('');
      setMonthlyVal('');
    },
  };
}

// Draft state + save/clear handlers for the Settings panel's per-platform spending-limit forms and the AI-key form; keeps parsing/persistence out of the presentational SettingsView.
export function useSettingsForm({ limits, onChangeLimits, aiConfig, onChangeAiConfig }: Params) {
  const caps: Record<CapPlatform, CapDraft> = {
    claude: useCapDraft(limits.claude, (l) => onChangeLimits('claude', l)),
    codex: useCapDraft(limits.codex, (l) => onChangeLimits('codex', l)),
  };
  const [aiKey, setAiKey] = useState(aiConfig.apiKey);
  const [showKey, setShowKey] = useState(false);

  const providers = Object.keys(PROVIDER_LABELS) as AiProvider[];

  function changeProvider(provider: AiProvider) {
    // Reset the model to the new provider's first option AND clear the saved key:
    // keys are provider-specific, so carrying one over would send the wrong
    // credential to the new provider's API (e.g. an Anthropic key to OpenAI).
    setAiKey('');
    onChangeAiConfig({ ...aiConfig, provider, model: PROVIDER_MODELS[provider][0], apiKey: '' });
  }
  function saveAiKey() {
    onChangeAiConfig({ ...aiConfig, apiKey: aiKey.trim() });
  }
  function clearAiKey() {
    setAiKey('');
    onChangeAiConfig({ ...aiConfig, apiKey: '' });
  }

  return {
    caps,
    aiKey,
    setAiKey,
    showKey,
    setShowKey,
    providers,
    changeProvider,
    saveAiKey,
    clearAiKey,
  };
}
