import { KeyValueRow } from '@/components/design-system/molecules/KeyValueRow/KeyValueRow';
import { RankedMeterList } from '@/components/design-system/molecules/RankedMeterList/RankedMeterList';
import { Section } from '@/components/design-system/organisms/Section/Section';
import type { RejectionsPanelProps } from './types';
import { LIST_LABEL } from './utils';

export function RejectionsPanel({ view, className }: RejectionsPanelProps) {
  return (
    <Section title={view.title} description={view.description} help={view.help} state={view.state} ai={view.ai} className={className}>
      <div className="flex flex-col gap-4">
        {view.split.length > 0 ? (
          <div className="flex flex-col gap-2 border-b border-line pb-4">
            {view.split.map((part) => (
              <KeyValueRow key={part.key} label={part.label} value={part.value} tone="warning" />
            ))}
          </div>
        ) : null}
        <RankedMeterList ariaLabel={LIST_LABEL} rows={view.rows} tone="warning" mono labelWidth="lg" />
      </div>
    </Section>
  );
}
