import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { PROVIDER_LABELS, PROVIDER_MODELS } from './useAiConfig';
import { useAiInsightCtx } from './useAiInsightContext';
import { useArchive } from './useArchive';
import { useConfigMode } from './useConfigMode';
import { usePlatformLimits } from './useLimits';
import { useLiveData } from './useLiveData';
import { usePolling } from './usePolling';
import { useSettingsForm, type CapDraft } from './useSettingsForm';
import { useSource } from './useSource';
import { useTheme } from './useTheme';
import { isOptedOut, setOptOut } from '@/lib/analytics';
import { resolveLimitAlerts, type CapPlatform } from '@/lib/limits';
import { modelPicker } from '@/lib/views/ai';
import {
  SETTINGS_SECTIONS,
  archiveView,
  budgetAlertsDescription,
  capGroup,
  codexAccountRows,
  dataFolders,
  detectedModeLabel,
  limitAlertsDescription,
  localeWeekStartNote,
  spendingDescription,
  thresholdViews,
  toggleThreshold,
  versionView,
  type AgentAlertChoice,
  type AiSettingsView,
  type AlertModeChoice,
  type AlertSettingsView,
  type CapPeriod,
  type DataSettingsView,
  type DisplaySettingsView,
  type GeneralSettingsView,
  type SpendingCapsSettingsView,
  type ThemeChoice,
  type UsageModeChoice,
  type WeekStartChoice,
} from '@/lib/views/settings';
import { localeDefaultWeekStart } from '@/lib/week';
import type { AiProvider, CodexConfigData, SourcesInfo } from '@/types';

export interface SettingsPageView {
  description: string;
  general: { view: GeneralSettingsView; onModeChange: (mode: UsageModeChoice) => void };
  display: {
    view: DisplaySettingsView;
    onWeekStartChange: (weekStart: WeekStartChoice) => void;
    onThemeChange: (theme: ThemeChoice) => void;
  };
  alerts: {
    view: AlertSettingsView;
    onAgentChange: (mode: AgentAlertChoice) => void;
    onLimitModeChange: (mode: AlertModeChoice) => void;
    onThresholdToggle: (threshold: number) => void;
    onBudgetChange: (mode: AlertModeChoice) => void;
  };
  spending: {
    view: SpendingCapsSettingsView;
    onChange: (platform: CapPlatform, period: CapPeriod, value: string) => void;
    onSave: (platform: CapPlatform) => void;
    onClear: (platform: CapPlatform) => void;
  };
  ai: {
    view: AiSettingsView;
    onProviderChange: (provider: string) => void;
    onModelChange: (model: string) => void;
    onKeyChange: (key: string) => void;
    onToggleKeyShown: () => void;
    onSaveKey: () => void;
    onClearKey: () => void;
  };
  data: { view: DataSettingsView; onForget: () => void; onTelemetryChange: (optOut: boolean) => void };
}

const DESCRIPTION = 'Preferences are stored in this browser. Nothing here changes Claude Code or Codex.';

const PROVIDER_OPTIONS = (Object.keys(PROVIDER_LABELS) as AiProvider[]).map((provider) => ({
  value: provider,
  label: PROVIDER_LABELS[provider],
}));

function setCapValue(draft: CapDraft, period: CapPeriod, value: string): void {
  if (period === 'daily') draft.setDailyVal(value);
  else if (period === 'weekly') draft.setWeeklyVal(value);
  else draft.setMonthlyVal(value);
}

export function useSettingsPage(): SettingsPageView {
  const { hash, key: locationKey } = useLocation();
  const { settings, setSettings, detectedMode } = useConfigMode();
  const { aiConfig, setAiConfig } = useAiInsightCtx();
  const [limits, setLimits] = usePlatformLimits();
  const { codexAvailable } = useSource();
  const { codexLive, version } = useLiveData();
  const archive = useArchive();
  const { theme, setTheme } = useTheme();
  const [analyticsOptOut, setAnalyticsOptOut] = useState(isOptedOut);

  // Codex status polls only with Codex data (same gate as the platform switcher); shares the app-wide /api/sources poll.
  const codexConfig = usePolling<CodexConfigData>(codexAvailable ? '/api/codex/config' : '', 60000);
  const sources = usePolling<SourcesInfo>('/api/sources', 60000);

  const { caps, aiKey, setAiKey, showKey, setShowKey, changeProvider, saveAiKey, clearAiKey } = useSettingsForm({
    limits,
    onChangeLimits: setLimits,
    aiConfig,
    onChangeAiConfig: setAiConfig,
  });

  // Deferred a task: the shell resets its scroll column in an effect that runs after this one on a route change. A timer, not rAF, which never fires in a background tab.
  useEffect(() => {
    const id = hash.slice(1);
    if (!SETTINGS_SECTIONS.some((section) => section.id === id)) return undefined;
    const timer = setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }), 0);
    return () => clearTimeout(timer);
  }, [hash, locationKey]);

  const general = useMemo<GeneralSettingsView>(
    () => ({
      modeTitle: codexAvailable ? 'Claude usage mode' : 'Usage mode',
      mode: settings.modeOverride,
      detected: detectedModeLabel(detectedMode),
      overridden: settings.modeOverride !== 'auto',
      codex: codexAvailable ? codexAccountRows(codexConfig.data, codexLive.data) : null,
    }),
    [codexAvailable, settings.modeOverride, detectedMode, codexConfig.data, codexLive.data],
  );

  const display = useMemo<DisplaySettingsView>(
    () => ({
      weekStart: settings.weekStartDay,
      localeNote: localeWeekStartNote(settings.weekStartDay, localeDefaultWeekStart()),
      theme,
    }),
    [settings.weekStartDay, theme],
  );

  const limitAlerts = useMemo(() => resolveLimitAlerts(settings.limitAlerts), [settings.limitAlerts]);
  const alerts = useMemo<AlertSettingsView>(
    () => ({
      agent: settings.agentAlert,
      limitDescription: limitAlertsDescription(codexAvailable),
      limitMode: limitAlerts.mode,
      thresholds: thresholdViews(limitAlerts),
      budgetDescription: budgetAlertsDescription(codexAvailable),
      budgetMode: settings.budgetAlert,
    }),
    [settings.agentAlert, settings.budgetAlert, limitAlerts, codexAvailable],
  );

  const { dailyVal: claudeDaily, weeklyVal: claudeWeekly, monthlyVal: claudeMonthly } = caps.claude;
  const { dailyVal: codexDaily, weeklyVal: codexWeekly, monthlyVal: codexMonthly } = caps.codex;
  const spending = useMemo<SpendingCapsSettingsView>(() => {
    const claude = { daily: claudeDaily, weekly: claudeWeekly, monthly: claudeMonthly };
    const codex = { daily: codexDaily, weekly: codexWeekly, monthly: codexMonthly };
    return {
      description: spendingDescription(codexAvailable),
      groups: codexAvailable ? [capGroup('claude', 'Claude', claude), capGroup('codex', 'Codex', codex)] : [capGroup('claude', null, claude)],
    };
  }, [codexAvailable, claudeDaily, claudeWeekly, claudeMonthly, codexDaily, codexWeekly, codexMonthly]);

  const ai = useMemo<AiSettingsView>(
    () => ({
      provider: aiConfig.provider,
      providers: PROVIDER_OPTIONS,
      model: aiConfig.model,
      models: modelPicker(aiConfig.model, PROVIDER_MODELS[aiConfig.provider]).options,
      key: aiKey,
      keyPlaceholder: aiConfig.apiKey ? '•••••••• saved' : 'Paste your API key',
      keyShown: showKey,
      keySaved: Boolean(aiConfig.apiKey),
    }),
    [aiConfig.provider, aiConfig.model, aiConfig.apiKey, aiKey, showKey],
  );

  const data = useMemo<DataSettingsView>(
    () => ({
      archive: archiveView(archive.summary, archive.loading, archive.busy, archive.error),
      telemetryOptOut: analyticsOptOut,
      folders: dataFolders(sources.data, sources.loading, sources.claudeDir, codexConfig.data?.dir ?? null),
      version: versionView(version.data, version.loading),
    }),
    [
      archive.summary, archive.loading, archive.busy, archive.error, analyticsOptOut, sources.data, sources.loading,
      sources.claudeDir, codexConfig.data, version.data, version.loading,
    ],
  );

  return {
    description: DESCRIPTION,
    general: { view: general, onModeChange: (modeOverride) => setSettings({ ...settings, modeOverride }) },
    display: {
      view: display,
      onWeekStartChange: (weekStartDay) => setSettings({ ...settings, weekStartDay }),
      onThemeChange: setTheme,
    },
    alerts: {
      view: alerts,
      onAgentChange: (agentAlert) => setSettings({ ...settings, agentAlert }),
      onLimitModeChange: (mode) => setSettings({ ...settings, limitAlerts: { ...limitAlerts, mode } }),
      onThresholdToggle: (threshold) =>
        setSettings({
          ...settings,
          limitAlerts: { ...limitAlerts, thresholds: toggleThreshold(limitAlerts.thresholds, threshold) },
        }),
      onBudgetChange: (budgetAlert) => setSettings({ ...settings, budgetAlert }),
    },
    spending: {
      view: spending,
      onChange: (platform, period, value) => setCapValue(caps[platform], period, value),
      onSave: (platform) => caps[platform].save(),
      onClear: (platform) => caps[platform].clear(),
    },
    ai: {
      view: ai,
      onProviderChange: (provider) => {
        if (provider in PROVIDER_LABELS && provider !== aiConfig.provider) changeProvider(provider as AiProvider);
      },
      onModelChange: (model) => {
        if (model) setAiConfig({ ...aiConfig, model });
      },
      onKeyChange: setAiKey,
      onToggleKeyShown: () => setShowKey((shown) => !shown),
      onSaveKey: saveAiKey,
      onClearKey: clearAiKey,
    },
    data: {
      view: data,
      onForget: () => void archive.forget(),
      onTelemetryChange: (optOut) => {
        setOptOut(optOut);
        setAnalyticsOptOut(optOut);
      },
    },
  };
}
