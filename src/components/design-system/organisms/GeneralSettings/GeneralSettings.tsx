import { SegmentedControl } from '@/components/design-system/atoms/SegmentedControl/SegmentedControl';
import { SettingRow } from '@/components/design-system/atoms/SettingRow/SettingRow';
import { KeyValueRow } from '@/components/design-system/molecules/KeyValueRow/KeyValueRow';
import { Section } from '@/components/design-system/organisms/Section/Section';
import { USAGE_MODE_OPTIONS } from '@/lib/views/settings';
import type { GeneralSettingsProps } from './types';
import { STATUS_TONE } from './utils';

export function GeneralSettings({ id, view, onModeChange }: GeneralSettingsProps) {
  return (
    <div id={id} className="scroll-mt-6">
      <Section title="General" description="How the dashboard reads your accounts">
        <div className="flex flex-col divide-y divide-line">
          <SettingRow
            title={view.modeTitle}
            description="Auto-detected from your Claude credentials. Override only if it is wrong — API mode swaps the subscription rate-limit view for estimated cost."
          >
            <SegmentedControl ariaLabel={view.modeTitle} options={USAGE_MODE_OPTIONS} value={view.mode} onChange={onModeChange} />
            <p className="text-caption text-fg-muted">
              Detected: <span className="font-medium text-fg">{view.detected}</span>
              {view.overridden ? ' · overridden' : null}
            </p>
          </SettingRow>
          {view.codex ? (
            <SettingRow
              layout="stacked"
              title="Codex"
              description="Detected from the data folder the ChatGPT desktop app writes. Read-only — the dashboard never refreshes or changes the Codex login."
            >
              <div className="flex flex-col gap-2">
                {view.codex.map((row) => (
                  <div key={row.label} className="flex min-w-0 flex-col gap-0.5">
                    <KeyValueRow label={row.label} value={row.value} tone={STATUS_TONE[row.tone]} />
                    {row.note ? <p className="text-right text-caption text-fg-subtle">{row.note}</p> : null}
                  </div>
                ))}
              </div>
            </SettingRow>
          ) : null}
        </div>
      </Section>
    </div>
  );
}
