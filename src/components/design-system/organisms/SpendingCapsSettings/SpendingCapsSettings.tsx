import { Section } from '@/components/design-system/organisms/Section/Section';
import { SpendingCapsForm } from './SpendingCapsForm/SpendingCapsForm';
import type { SpendingCapsSettingsProps } from './types';

export function SpendingCapsSettings({ id, view, onChange, onSave, onClear }: SpendingCapsSettingsProps) {
  return (
    <div id={id} className="scroll-mt-6">
      <Section title="Spending limits" description="Caps on estimated cost, in US dollars">
        <div className="flex flex-col gap-4">
          <p className="max-w-3xl text-small text-fg-muted">{view.description}</p>
          <div className="flex flex-col divide-y divide-line">
            {view.groups.map((group) => (
              <SpendingCapsForm
                key={group.key}
                idPrefix={id}
                group={group}
                onChange={(period, value) => onChange(group.key, period, value)}
                onSave={() => onSave(group.key)}
                onClear={() => onClear(group.key)}
              />
            ))}
          </div>
        </div>
      </Section>
    </div>
  );
}
