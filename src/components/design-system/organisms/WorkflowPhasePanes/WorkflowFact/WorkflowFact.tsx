import { InfoTip } from '@/components/design-system/atoms/InfoTip/InfoTip';
import { cn } from '@/lib/cn';
import { FACT_TONE_CLASS } from '../utils';
import type { WorkflowFactProps } from './types';

export function WorkflowFact({ fact }: WorkflowFactProps) {
  return (
    <div className="flex flex-none items-center gap-1.5 whitespace-nowrap text-caption text-fg-subtle">
      <dt>{fact.label}</dt>
      <dd className="flex items-center gap-1.5">
        <span className={cn('font-mono tabular-nums', FACT_TONE_CLASS[fact.tone])}>{fact.value}</span>
        {fact.help ? <InfoTip label={`About ${fact.label.toLowerCase()}`} content={fact.help} /> : null}
      </dd>
    </div>
  );
}
