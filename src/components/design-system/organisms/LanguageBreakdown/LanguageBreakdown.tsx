import { RankedMeterList } from '@/components/design-system/molecules/RankedMeterList/RankedMeterList';
import { Section } from '@/components/design-system/organisms/Section/Section';
import type { LanguageBreakdownProps } from './types';
import { LIST_LABEL } from './utils';

export function LanguageBreakdown({ view, className }: LanguageBreakdownProps) {
  return (
    <Section title={view.title} description={view.description} help={view.help} state={view.state} ai={view.ai} className={className}>
      <div className="flex flex-col gap-4">
        <RankedMeterList ariaLabel={LIST_LABEL} rows={view.rows} />
        <p className="text-caption text-fg-subtle">{view.footnote}</p>
      </div>
    </Section>
  );
}
