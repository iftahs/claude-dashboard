import { SegmentedControl } from '@/components/design-system/atoms/SegmentedControl/SegmentedControl';
import { SettingRow } from '@/components/design-system/atoms/SettingRow/SettingRow';
import { Section } from '@/components/design-system/organisms/Section/Section';
import { THEME_OPTIONS, WEEK_START_OPTIONS } from '@/lib/views/settings';
import type { DisplaySettingsProps } from './types';

export function DisplaySettings({ id, view, onWeekStartChange, onThemeChange }: DisplaySettingsProps) {
  return (
    <div id={id} className="scroll-mt-6">
      <Section title="Display" description="How the dashboard looks and counts weeks">
        <div className="flex flex-col divide-y divide-line">
          <SettingRow
            title="Week start"
            description="First day of the week for the weekly spending window, its reset countdown and the activity heatmap. Auto follows your browser locale."
          >
            <SegmentedControl ariaLabel="Week start" options={WEEK_START_OPTIONS} value={view.weekStart} onChange={onWeekStartChange} />
            {view.localeNote ? <p className="text-caption text-fg-muted">{view.localeNote}</p> : null}
          </SettingRow>
          <SettingRow title="Theme" description="Dark or light. The choice is remembered in this browser.">
            <SegmentedControl ariaLabel="Theme" options={THEME_OPTIONS} value={view.theme} onChange={onThemeChange} />
          </SettingRow>
        </div>
      </Section>
    </div>
  );
}
