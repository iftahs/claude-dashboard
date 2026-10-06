import { Fragment, memo } from 'react';
import { Tooltip } from '@/components/design-system/atoms/Tooltip/Tooltip';
import { Section } from '@/components/design-system/organisms/Section/Section';
import { cn } from '@/lib/cn';
import type { PeakHoursHeatmapProps } from './types';
import { GRID_CLASS, GRID_LABEL, HEAT_CLASS, HEAT_LEVELS, LEGEND_INSET, TOOLTIP_DELAY_MS } from './utils';

export const PeakHoursHeatmap = memo(function PeakHoursHeatmap({ view, className }: PeakHoursHeatmapProps) {
  return (
    <Section title={view.title} description={view.description} help={view.help} state={view.state} className={className}>
      <div className="flex min-w-0 flex-col gap-3">
        {view.peak ? (
          <p className="text-small text-fg-muted">
            Your busiest time is <span className="font-medium text-fg">{view.peak.when}</span>, with{' '}
            <span className="font-mono text-fg">{view.peak.tokens}</span> effective tokens.
          </p>
        ) : null}
        <div role="group" aria-label={GRID_LABEL} className={GRID_CLASS}>
          <span aria-hidden="true" />
          {view.hours.map((hour, index) => (
            <span key={`hour-${index}`} aria-hidden="true" className="h-4 whitespace-nowrap text-caption text-fg-subtle">
              {hour}
            </span>
          ))}
          {view.rows.map((row) => (
            <Fragment key={row.key}>
              <span className="flex items-center text-caption text-fg-muted">{row.label}</span>
              {row.cells.map((cell) => (
                <Tooltip key={cell.key} content={cell.label} delay={TOOLTIP_DELAY_MS}>
                  <span
                    role="img"
                    aria-label={cell.label}
                    className={cn('h-5 rounded-[2px] hover:outline hover:outline-1 hover:outline-fg-muted', HEAT_CLASS[cell.level])}
                  />
                </Tooltip>
              ))}
            </Fragment>
          ))}
        </div>
        <div aria-hidden="true" className={cn('flex items-center gap-1.5 text-caption text-fg-subtle', LEGEND_INSET)}>
          Less
          {HEAT_LEVELS.map((level) => (
            <span key={level} className={cn('h-3 w-4 rounded-[2px]', HEAT_CLASS[level])} />
          ))}
          More
        </div>
      </div>
    </Section>
  );
});
