import { RankedMeterList } from '@/components/design-system/molecules/RankedMeterList/RankedMeterList';
import { Section } from '@/components/design-system/organisms/Section/Section';
import type { ToolUsageProps } from './types';
import { LIST_LABEL } from './utils';

export function ToolUsage({ view, className }: ToolUsageProps) {
  return (
    <Section title={view.title} description={view.description} help={view.help} state={view.state} ai={view.ai} className={className}>
      <RankedMeterList ariaLabel={LIST_LABEL} rows={view.rows} mono labelWidth="lg" />
    </Section>
  );
}
