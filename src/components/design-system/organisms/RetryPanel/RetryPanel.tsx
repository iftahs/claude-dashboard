import { GroupLabel } from '@/components/design-system/atoms/GroupLabel/GroupLabel';
import { KeyValueRow } from '@/components/design-system/molecules/KeyValueRow/KeyValueRow';
import { Section } from '@/components/design-system/organisms/Section/Section';
import { cn } from '@/lib/cn';
import type { RetryPanelProps } from './types';
import { RATE_LABEL } from './utils';

export function RetryPanel({ view, className }: RetryPanelProps) {
  return (
    <Section title={view.title} description={view.description} help={view.help} state={view.state} ai={view.ai} className={className}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <GroupLabel as="span">{RATE_LABEL}</GroupLabel>
          <span className={cn('text-metric-lg tabular-nums', view.applies ? 'text-fg' : 'text-fg-subtle')}>{view.rate}</span>
          <p className="text-small text-fg-muted">{view.rateNote}</p>
        </div>
        {view.facts.length > 0 ? (
          <div className="flex flex-col gap-2 border-t border-line pt-4">
            {view.facts.map((fact) => (
              <KeyValueRow key={fact.key} label={fact.label} value={fact.value} tone={fact.tone} />
            ))}
          </div>
        ) : null}
        {view.footnote ? <p className="text-caption text-fg-subtle">{view.footnote}</p> : null}
      </div>
    </Section>
  );
}
