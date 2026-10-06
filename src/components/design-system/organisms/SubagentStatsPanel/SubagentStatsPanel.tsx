import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import { GroupLabel } from '@/components/design-system/atoms/GroupLabel/GroupLabel';
import { KeyValueRow } from '@/components/design-system/molecules/KeyValueRow/KeyValueRow';
import { ModelChip } from '@/components/design-system/molecules/ModelChip/ModelChip';
import { Section } from '@/components/design-system/organisms/Section/Section';
import type { SubagentStatsPanelProps } from './types';
import { MODELS_LABEL, TYPES_LABEL } from './utils';

export function SubagentStatsPanel({ view, className }: SubagentStatsPanelProps) {
  return (
    <Section title={view.title} description={view.description} help={view.help} state={view.state} ai={view.ai} className={className}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          {view.facts.map((fact) => (
            <KeyValueRow key={fact.key} label={fact.label} value={fact.value} tone={fact.tone} />
          ))}
        </div>

        {view.emptyNote ? <p className="text-small text-fg-muted">{view.emptyNote}</p> : null}

        {view.types.length > 0 ? (
          <div className="flex flex-col gap-2 border-t border-line pt-4">
            <GroupLabel as="span">{TYPES_LABEL}</GroupLabel>
            <ul aria-label={TYPES_LABEL} className="flex flex-wrap gap-x-4 gap-y-2">
              {view.types.map((type) => (
                <li key={type.key} className="flex items-center gap-1.5">
                  <Badge>{type.label}</Badge>
                  <span className="font-mono text-mono text-fg">{type.count}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {view.models.length > 0 ? (
          <div className="flex flex-col gap-2 border-t border-line pt-4">
            <GroupLabel as="span">{MODELS_LABEL}</GroupLabel>
            <ul aria-label={MODELS_LABEL} className="flex flex-col gap-2">
              {view.models.map((model) => (
                <li key={model.key} className="flex items-center justify-between gap-3">
                  <ModelChip model={model.model} />
                  <span className="font-mono text-mono text-fg">{model.count}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </Section>
  );
}
