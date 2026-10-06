import { memo } from 'react';
import { SegmentedControl } from '@/components/design-system/atoms/SegmentedControl/SegmentedControl';
import { Section } from '@/components/design-system/organisms/Section/Section';
import { PROJECT_SORT_OPTIONS } from '@/lib/views/sessions';
import { ProjectBreakdownRow } from './ProjectBreakdownRow/ProjectBreakdownRow';
import type { ProjectBreakdownProps } from './types';
import { LIST_LABEL, SORT_LABEL } from './utils';

export const ProjectBreakdown = memo(function ProjectBreakdown({ view, onSortChange, onTagsChange, className }: ProjectBreakdownProps) {
  return (
    <Section
      title={view.title}
      description={view.description}
      help={view.help}
      state={view.state}
      className={className}
      actions={
        view.state ? undefined : (
          <SegmentedControl ariaLabel={SORT_LABEL} size="sm" value={view.sort} onChange={onSortChange} options={PROJECT_SORT_OPTIONS} />
        )
      }
    >
      <ul aria-label={LIST_LABEL} className="-mx-1 flex max-h-[560px] min-w-0 flex-col gap-4 overflow-y-auto px-1 py-0.5">
        {view.rows.map((row) => (
          <ProjectBreakdownRow key={row.path} row={row} suggestions={view.suggestions} onTagsChange={onTagsChange} />
        ))}
      </ul>
    </Section>
  );
});
