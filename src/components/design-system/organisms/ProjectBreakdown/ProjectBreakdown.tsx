import { memo } from 'react';
import { SegmentedControl } from '@/components/design-system/atoms/SegmentedControl/SegmentedControl';
import { Section } from '@/components/design-system/organisms/Section/Section';
import { PROJECT_SORT_OPTIONS } from '@/lib/views/sessions';
import { ProjectBreakdownRow } from './ProjectBreakdownRow/ProjectBreakdownRow';
import type { ProjectBreakdownProps } from './types';
import { LIST_LABEL, SORT_LABEL, TOTAL_LABEL, TOTAL_TITLE } from './utils';

export const ProjectBreakdown = memo(function ProjectBreakdown({ view, onSortChange, onTagsChange, onOpenSession, className }: ProjectBreakdownProps) {
  return (
    <Section
      title={view.title}
      description={view.description}
      help={view.help}
      state={view.state}
      className={className}
      actions={
        view.state ? undefined : (
          <div className="flex flex-col items-end gap-2">
            {view.total ? (
              <p title={TOTAL_TITLE} className="flex items-baseline gap-2">
                <span className="text-label uppercase text-fg-subtle">{TOTAL_LABEL}</span>
                <span className="whitespace-nowrap font-mono text-metric tabular-nums text-fg">{view.total}</span>
              </p>
            ) : null}
            <SegmentedControl ariaLabel={SORT_LABEL} size="sm" value={view.sort} onChange={onSortChange} options={PROJECT_SORT_OPTIONS} />
          </div>
        )
      }
    >
      <ul aria-label={LIST_LABEL} className="-mx-1 flex max-h-[560px] min-w-0 flex-col gap-4 overflow-y-auto px-1 py-0.5">
        {view.rows.map((row) => (
          <ProjectBreakdownRow
            key={row.path}
            row={row}
            noun={view.noun}
            suggestions={view.suggestions}
            onTagsChange={onTagsChange}
            onOpenSession={onOpenSession}
          />
        ))}
      </ul>
    </Section>
  );
});
