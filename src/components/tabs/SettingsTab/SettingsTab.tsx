import { useState } from 'react';
import { SettingsView } from '@/components/design-system/organisms/SettingsView/SettingsView';
import { useConfigMode } from '@/hooks/useConfigMode';
import { useAiInsightCtx } from '@/hooks/useAiInsightContext';
import { isOptedOut, setOptOut } from '@/lib/analytics';
import type { SettingsTabProps } from './types';

export function SettingsTab({ limits, onChangeLimits }: SettingsTabProps) {
  const { settings, setSettings, detectedMode } = useConfigMode();
  const { aiConfig, setAiConfig } = useAiInsightCtx();
  const [analyticsOptOut, setAnalyticsOptOut] = useState(isOptedOut());

  return (
    <SettingsView
      limits={limits}
      onChangeLimits={onChangeLimits}
      settings={settings}
      onChangeSettings={setSettings}
      detectedMode={detectedMode}
      analyticsOptOut={analyticsOptOut}
      onChangeAnalyticsOptOut={(v) => {
        setOptOut(v);
        setAnalyticsOptOut(v);
      }}
      aiConfig={aiConfig}
      onChangeAiConfig={setAiConfig}
    />
  );
}
