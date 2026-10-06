import { useId } from 'react';
import { Checkbox } from '@/components/design-system/atoms/Checkbox/Checkbox';
import { SegmentedControl } from '@/components/design-system/atoms/SegmentedControl/SegmentedControl';
import { SettingRow } from '@/components/design-system/atoms/SettingRow/SettingRow';
import { Section } from '@/components/design-system/organisms/Section/Section';
import { AGENT_ALERT_OPTIONS, ALERT_MODE_OPTIONS } from '@/lib/views/settings';
import type { AlertSettingsProps } from './types';

export function AlertSettings({ id, view, onAgentChange, onLimitModeChange, onThresholdToggle, onBudgetChange }: AlertSettingsProps) {
  const thresholdsId = useId();
  const thresholdsOff = view.limitMode === 'off';

  return (
    <div id={id} className="scroll-mt-6">
      <Section title="Alerts" description="When the dashboard notifies you, and how">
        <div className="flex flex-col divide-y divide-line">
          <SettingRow
            title="Agent alerts"
            description="How to alert you when an agent is waiting on you for a confirmation or your attention. The badge always shows in the sidebar and on the Agents page; this adds a browser notification, a chime, or both."
          >
            <SegmentedControl ariaLabel="Agent alerts" options={AGENT_ALERT_OPTIONS} value={view.agent} onChange={onAgentChange} />
          </SettingRow>
          <SettingRow
            title="Limit alerts"
            description={view.limitDescription}
            below={
              <div role="group" aria-labelledby={thresholdsId} className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
                <span id={thresholdsId} className="text-caption text-fg-muted">
                  Alert at
                </span>
                {view.thresholds.map((threshold) => (
                  <Checkbox
                    key={threshold.value}
                    checked={threshold.checked}
                    disabled={thresholdsOff}
                    onCheckedChange={() => onThresholdToggle(threshold.value)}
                  >
                    {threshold.label}
                  </Checkbox>
                ))}
                <span className="text-caption text-fg-subtle">and always at 100%, when the limit is reached</span>
              </div>
            }
          >
            <SegmentedControl ariaLabel="Limit alerts" options={ALERT_MODE_OPTIONS} value={view.limitMode} onChange={onLimitModeChange} />
          </SettingRow>
          <SettingRow title="Budget alerts" description={view.budgetDescription}>
            <SegmentedControl ariaLabel="Budget alerts" options={ALERT_MODE_OPTIONS} value={view.budgetMode} onChange={onBudgetChange} />
          </SettingRow>
        </div>
      </Section>
    </div>
  );
}
