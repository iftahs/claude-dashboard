import { useState } from 'react';
import { SettingsView } from '@/components/legacy/design-system/organisms/SettingsView/SettingsView';
import { useConfigMode } from '@/hooks/useConfigMode';
import { useAiInsightCtx } from '@/hooks/useAiInsightContext';
import { useArchive } from '@/hooks/useArchive';
import { usePlatformLimits } from '@/hooks/useLimits';
import { useLiveData } from '@/hooks/useLiveData';
import { usePolling } from '@/hooks/usePolling';
import { useSource } from '@/hooks/useSource';
import { isOptedOut, setOptOut } from '@/lib/analytics';
import { codexStatusRows } from '@/lib/views/settings';
import type { CodexConfigData, SourcesInfo } from '@/types';

export function SettingsTab() {
  const { settings, setSettings, detectedMode } = useConfigMode();
  const { aiConfig, setAiConfig } = useAiInsightCtx();
  const [limits, setLimits] = usePlatformLimits();
  const { codexAvailable } = useSource();
  const { codexLive } = useLiveData();
  const archive = useArchive();
  const [analyticsOptOut, setAnalyticsOptOut] = useState(isOptedOut());

  // Codex status polls only with Codex data (same gate as the platform switcher); shares the app-wide /api/sources poll.
  const codexConfig = usePolling<CodexConfigData>(codexAvailable ? '/api/codex/config' : '', 60000);
  const sources = usePolling<SourcesInfo>('/api/sources', 60000);
  const codex = codexAvailable
    ? codexStatusRows(
        codexConfig.data,
        codexLive.data,
        sources.data?.codexDir ?? sources.data?.codex?.dir ?? codexConfig.data?.dir ?? null,
      )
    : null;

  return (
    <SettingsView
      limits={limits}
      onChangeLimits={setLimits}
      settings={settings}
      onChangeSettings={setSettings}
      detectedMode={detectedMode}
      codex={codex}
      archive={{ summary: archive.summary, busy: archive.busy, error: archive.error, onForget: () => void archive.forget() }}
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
