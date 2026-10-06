import { GroupLabel } from '@/components/design-system/atoms/GroupLabel/GroupLabel';
import { KeyValueRow } from '@/components/design-system/molecules/KeyValueRow/KeyValueRow';
import { RankedMeterList } from '@/components/design-system/molecules/RankedMeterList/RankedMeterList';
import { Section } from '@/components/design-system/organisms/Section/Section';
import type { YieldPanelProps } from './types';
import { STAGES_LABEL, TOKENS_LABEL, UNCOMMITTED_LABEL } from './utils';

export function YieldPanel({ view, className }: YieldPanelProps) {
  return (
    <Section title={view.title} description={view.description} help={view.help} state={view.state} ai={view.ai} className={className}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <RankedMeterList ariaLabel={STAGES_LABEL} rows={view.stages} />
          {view.stagesNote ? <p className="text-caption text-fg-subtle">{view.stagesNote}</p> : null}
        </div>

        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <GroupLabel as="span">{TOKENS_LABEL}</GroupLabel>
          {view.tokens.map((fact) => (
            <KeyValueRow key={fact.key} label={fact.label} value={fact.value} tone={fact.tone} help={fact.help ?? undefined} />
          ))}
        </div>

        {view.uncommitted.length > 0 ? (
          <div className="flex flex-col gap-2 border-t border-line pt-4">
            <GroupLabel as="span">{UNCOMMITTED_LABEL}</GroupLabel>
            <ul aria-label={UNCOMMITTED_LABEL} className="flex flex-col gap-2">
              {view.uncommitted.map((session) => (
                <li key={session.key} className="flex min-w-0 items-baseline gap-3">
                  <span title={session.project} className="min-w-0 flex-1 truncate text-small text-fg-muted">
                    {session.project}
                  </span>
                  <span className="flex-none whitespace-nowrap text-caption text-fg-subtle">{session.date}</span>
                  <span className="w-12 flex-none whitespace-nowrap text-right font-mono text-mono text-fg">{session.tokens}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <p className="text-caption text-fg-subtle">{view.footnote}</p>
      </div>
    </Section>
  );
}
