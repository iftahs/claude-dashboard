import { useEffect, useState } from 'react';
import { AiChat } from '@/components/design-system/organisms/AiChat/AiChat';
import { AiSettings } from '@/components/design-system/organisms/AiSettings/AiSettings';
import { AlertSettings } from '@/components/design-system/organisms/AlertSettings/AlertSettings';
import { DataSettings } from '@/components/design-system/organisms/DataSettings/DataSettings';
import { DisplaySettings } from '@/components/design-system/organisms/DisplaySettings/DisplaySettings';
import { GeneralSettings } from '@/components/design-system/organisms/GeneralSettings/GeneralSettings';
import { PluginsInventory } from '@/components/design-system/organisms/PluginsInventory/PluginsInventory';
import { ProfileCard } from '@/components/design-system/organisms/ProfileCard/ProfileCard';
import { SpendingCapsSettings } from '@/components/design-system/organisms/SpendingCapsSettings/SpendingCapsSettings';
import { TasksPanel } from '@/components/design-system/organisms/TasksPanel/TasksPanel';
import { SplitLayout } from '@/components/design-system/templates/SplitLayout/SplitLayout';
import type { CapPlatform } from '@/lib/limits';
import type { AiChatMessageView } from '@/lib/views/ai';
import {
  budgetAlertsDescription,
  capGroup,
  limitAlertsDescription,
  spendingDescription,
  thresholdViews,
  toggleThreshold,
  type AgentAlertChoice,
  type AlertModeChoice,
  type CapPeriod,
  type ThemeChoice,
  type UsageModeChoice,
  type WeekStartChoice,
} from '@/lib/views/settings';
import { Specimen } from '../../Specimen/Specimen';
import {
  ARCHIVE_LOADING,
  CHAT_ANSWER,
  CHAT_EMPTY,
  CHAT_FOLLOW_UPS,
  CHAT_MESSAGES,
  CHAT_SETUP,
  CODEX_ROWS,
  EMPTY_CAPS,
  FOLDERS,
  FOLDERS_FAILED,
  FORGET_DELAY_MS,
  INITIAL_CAPS,
  INVENTORY_VIEWS,
  MODEL_OPTIONS,
  PROFILE_CLAUDE,
  PROFILE_CODEX,
  PROFILE_FAILED,
  PROFILE_LOADING,
  PROVIDER_OPTIONS,
  TASKS_VIEWS,
  VERSION_LOADING,
  VERSION_UPDATE,
  chatView,
  specimenArchive,
} from './utils';

export function WorkspaceAiSettingsSpecimens() {
  const [messages, setMessages] = useState<AiChatMessageView[]>([...CHAT_MESSAGES]);
  const [mode, setMode] = useState<UsageModeChoice>('auto');
  const [weekStart, setWeekStart] = useState<WeekStartChoice>('auto');
  const [theme, setTheme] = useState<ThemeChoice>('dark');
  const [agentAlert, setAgentAlert] = useState<AgentAlertChoice>('notification');
  const [limitMode, setLimitMode] = useState<AlertModeChoice>('notification');
  const [thresholds, setThresholds] = useState([70, 90]);
  const [budgetMode, setBudgetMode] = useState<AlertModeChoice>('off');
  const [caps, setCaps] = useState(INITIAL_CAPS);
  const [savedCaps, setSavedCaps] = useState('');
  const [provider, setProvider] = useState('claude');
  const [model, setModel] = useState(MODEL_OPTIONS.claude[0].value);
  const [keyDraft, setKeyDraft] = useState('');
  const [keyShown, setKeyShown] = useState(false);
  const [keySaved, setKeySaved] = useState(false);
  const [forgetting, setForgetting] = useState(false);
  const [forgotten, setForgotten] = useState(false);
  const [optOut, setOptOut] = useState(false);

  useEffect(() => {
    if (!forgetting) return undefined;
    const id = setTimeout(() => {
      setForgetting(false);
      setForgotten(true);
    }, FORGET_DELAY_MS);
    return () => clearTimeout(id);
  }, [forgetting]);

  const onAsk = (question: string) =>
    setMessages((current) => [
      ...current.filter((message) => message.content),
      { id: `q${current.length}`, role: 'user', content: question },
      { id: `a${current.length}`, role: 'assistant', content: CHAT_ANSWER, datasets: ['projects'] },
    ]);

  const onCapChange = (platform: CapPlatform, period: CapPeriod, value: string) =>
    setCaps((current) => ({ ...current, [platform]: { ...current[platform], [period]: value } }));

  return (
    <>
      <Specimen name="ProfileCard" note="Wide for one platform, compact side by side under Both, then loading and failed" layout="stack">
        <ProfileCard view={PROFILE_CLAUDE} />
        <SplitLayout>
          <ProfileCard view={PROFILE_CLAUDE} compact />
          <ProfileCard view={PROFILE_CODEX} compact />
        </SplitLayout>
        <SplitLayout>
          <ProfileCard view={PROFILE_LOADING} compact />
          <ProfileCard view={PROFILE_FAILED} compact />
        </SplitLayout>
      </Specimen>
      <Specimen name="PluginsInventory" note="Merged inventory with a long name and items turned off, then empty, loading and failed" layout="stack">
        <PluginsInventory view={INVENTORY_VIEWS[0]} />
        <SplitLayout columns={3}>
          {INVENTORY_VIEWS.slice(1).map((view, index) => (
            <PluginsInventory key={index} view={view} />
          ))}
        </SplitLayout>
      </Specimen>
      <Specimen name="TasksPanel" note="Tasks cut at 12 with a note, a platform with no task list, empty and loading" layout="stack">
        {TASKS_VIEWS.slice(0, 2).map((view, index) => (
          <TasksPanel key={index} view={view} />
        ))}
        <SplitLayout>
          {TASKS_VIEWS.slice(2).map((view, index) => (
            <TasksPanel key={index} view={view} />
          ))}
        </SplitLayout>
      </Specimen>
      <Specimen
        name="AiChat"
        note="A conversation with a pending answer and a failed one (ask to add a turn), the empty conversation, and the setup state"
        layout="stack"
      >
        <div className="flex h-[480px] flex-col">
          <AiChat view={chatView(messages, CHAT_FOLLOW_UPS)} onAsk={onAsk} />
        </div>
        <SplitLayout>
          <div className="flex h-96 flex-col">
            <AiChat view={CHAT_EMPTY} onAsk={onAsk} />
          </div>
          <AiChat view={CHAT_SETUP} onAsk={onAsk} />
        </SplitLayout>
      </Specimen>
      <Specimen name="GeneralSettings" note="Usage mode with the detected line, and the read-only Codex rows" layout="stack">
        <GeneralSettings
          id="ds-settings-general"
          view={{ modeTitle: 'Claude usage mode', mode, detected: 'Subscription', overridden: mode !== 'auto', codex: CODEX_ROWS }}
          onModeChange={setMode}
        />
      </Specimen>
      <Specimen name="DisplaySettings" note="The theme control here is local to the specimen" layout="stack">
        <DisplaySettings
          id="ds-settings-display"
          view={{ weekStart, localeNote: weekStart === 'auto' ? 'Locale default: Monday' : null, theme }}
          onWeekStartChange={setWeekStart}
          onThemeChange={setTheme}
        />
      </Specimen>
      <Specimen name="AlertSettings" note="Set limit alerts to Off to see the disabled thresholds" layout="stack">
        <AlertSettings
          id="ds-settings-alerts"
          view={{
            agent: agentAlert,
            limitDescription: limitAlertsDescription(true),
            limitMode,
            thresholds: thresholdViews({ mode: limitMode, thresholds }),
            budgetDescription: budgetAlertsDescription(true),
            budgetMode,
          }}
          onAgentChange={setAgentAlert}
          onLimitModeChange={setLimitMode}
          onThresholdToggle={(threshold) => setThresholds((current) => toggleThreshold(current, threshold))}
          onBudgetChange={setBudgetMode}
        />
      </Specimen>
      <Specimen name="SpendingCapsSettings" note={savedCaps ? `Saved: ${savedCaps}` : 'One form per platform. Enter in a field saves it.'} layout="stack">
        <SpendingCapsSettings
          id="ds-settings-spending"
          view={{
            description: spendingDescription(true),
            groups: [capGroup('claude', 'Claude', caps.claude), capGroup('codex', 'Codex', caps.codex)],
          }}
          onChange={onCapChange}
          onSave={(platform) => setSavedCaps(platform)}
          onClear={(platform) => setCaps((current) => ({ ...current, [platform]: EMPTY_CAPS }))}
        />
      </Specimen>
      <Specimen name="AiSettings" note="Changing the provider resets the model. Nothing typed here is stored." layout="stack">
        <AiSettings
          id="ds-settings-ai"
          view={{
            provider,
            providers: PROVIDER_OPTIONS,
            model,
            models: MODEL_OPTIONS[provider],
            key: keyDraft,
            keyPlaceholder: keySaved ? '•••••••• saved' : 'Paste your API key',
            keyShown,
            keySaved,
          }}
          onProviderChange={(next) => {
            setProvider(next);
            setModel(MODEL_OPTIONS[next][0].value);
            setKeyDraft('');
            setKeySaved(false);
          }}
          onModelChange={setModel}
          onKeyChange={setKeyDraft}
          onToggleKeyShown={() => setKeyShown((shown) => !shown)}
          onSaveKey={() => setKeySaved(keyDraft.trim().length > 0)}
          onClearKey={() => {
            setKeyDraft('');
            setKeySaved(false);
          }}
        />
      </Specimen>
      <Specimen name="DataSettings" note="Ready with an update available and a forget flow, then loading and failed blocks" layout="stack">
        <DataSettings
          id="ds-settings-data"
          view={{
            archive: specimenArchive(forgotten, forgetting),
            telemetryOptOut: optOut,
            folders: FOLDERS,
            version: VERSION_UPDATE,
          }}
          onForget={() => setForgetting(true)}
          onTelemetryChange={setOptOut}
        />
        <DataSettings
          id="ds-settings-data-loading"
          view={{ archive: ARCHIVE_LOADING, telemetryOptOut: true, folders: FOLDERS_FAILED, version: VERSION_LOADING }}
          onForget={() => undefined}
          onTelemetryChange={() => undefined}
        />
      </Specimen>
    </>
  );
}
