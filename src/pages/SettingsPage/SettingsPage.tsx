import { PageHeader } from '@/components/design-system/atoms/PageHeader/PageHeader';
import { AiSettings } from '@/components/design-system/organisms/AiSettings/AiSettings';
import { AlertSettings } from '@/components/design-system/organisms/AlertSettings/AlertSettings';
import { DataSettings } from '@/components/design-system/organisms/DataSettings/DataSettings';
import { DisplaySettings } from '@/components/design-system/organisms/DisplaySettings/DisplaySettings';
import { GeneralSettings } from '@/components/design-system/organisms/GeneralSettings/GeneralSettings';
import { SpendingCapsSettings } from '@/components/design-system/organisms/SpendingCapsSettings/SpendingCapsSettings';
import { PageLayout } from '@/components/design-system/templates/PageLayout/PageLayout';
import { useSettingsPage } from '@/hooks/useSettingsPage';

export function SettingsPage() {
  const { description, general, display, alerts, spending, ai, data } = useSettingsPage();

  return (
    <PageLayout header={<PageHeader description={description} />}>
      <GeneralSettings id="general" view={general.view} onModeChange={general.onModeChange} />
      <DisplaySettings
        id="display"
        view={display.view}
        onWeekStartChange={display.onWeekStartChange}
        onThemeChange={display.onThemeChange}
      />
      <AlertSettings
        id="alerts"
        view={alerts.view}
        onAgentChange={alerts.onAgentChange}
        onLimitModeChange={alerts.onLimitModeChange}
        onThresholdToggle={alerts.onThresholdToggle}
        onBudgetChange={alerts.onBudgetChange}
      />
      <SpendingCapsSettings
        id="spending"
        view={spending.view}
        onChange={spending.onChange}
        onSave={spending.onSave}
        onClear={spending.onClear}
      />
      <AiSettings
        id="ai"
        view={ai.view}
        onProviderChange={ai.onProviderChange}
        onModelChange={ai.onModelChange}
        onKeyChange={ai.onKeyChange}
        onToggleKeyShown={ai.onToggleKeyShown}
        onSaveKey={ai.onSaveKey}
        onClearKey={ai.onClearKey}
      />
      <DataSettings id="data" view={data.view} onForget={data.onForget} onTelemetryChange={data.onTelemetryChange} />
    </PageLayout>
  );
}
