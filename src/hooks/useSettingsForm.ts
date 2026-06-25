import { useState } from 'react';
import { parseDollar, fmt } from '@/components/design-system/molecules/LimitsPanel/utils';
import { PROVIDER_LABELS, PROVIDER_MODELS } from './useAiConfig';
import type { Limits } from './useLimits';
import type { AiConfig, AiProvider } from '../types';

interface Params {
  limits: Limits;
  onChangeLimits: (l: Limits) => void;
  aiConfig: AiConfig;
  onChangeAiConfig: (c: AiConfig) => void;
}

/**
 * Draft state + save/clear handlers for the Settings panel's spending-limit and
 * AI-key forms. Keeps the parsing/persistence logic out of the presentational
 * SettingsView (which just renders inputs bound to this).
 */
export function useSettingsForm({ limits, onChangeLimits, aiConfig, onChangeAiConfig }: Params) {
  const [dailyVal, setDailyVal] = useState(fmt(limits.dailyLimit));
  const [weeklyVal, setWeeklyVal] = useState(fmt(limits.weeklyLimit));
  const [monthlyVal, setMonthlyVal] = useState(fmt(limits.monthlyLimit));
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
  function saveLimits() {
    onChangeLimits({
      dailyLimit: parseDollar(dailyVal),
      weeklyLimit: parseDollar(weeklyVal),
      monthlyLimit: parseDollar(monthlyVal),
    });
  }
  function clearLimits() {
    onChangeLimits({ dailyLimit: null, weeklyLimit: null, monthlyLimit: null });
    setDailyVal('');
    setWeeklyVal('');
    setMonthlyVal('');
  }

  return {
    dailyVal,
    setDailyVal,
    weeklyVal,
    setWeeklyVal,
    monthlyVal,
    setMonthlyVal,
    aiKey,
    setAiKey,
    showKey,
    setShowKey,
    providers,
    changeProvider,
    saveAiKey,
    clearAiKey,
    saveLimits,
    clearLimits,
  };
}
