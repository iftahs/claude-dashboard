import { Fragment, memo, useEffect, useRef } from 'react';
import { Tooltip } from '@/components/design-system/atoms/Tooltip/Tooltip';
import { Section } from '@/components/design-system/organisms/Section/Section';
import { cn } from '@/lib/cn';
import type { ActivityHeatmapProps } from './types';
import { CAPTION, FUTURE_CLASS, GRID_CLASS, GRID_LABEL, HEAT_CLASS, HEAT_LEVELS, LABEL_CLASS, TOOLTIP_DELAY_MS } from './utils';

export const ActivityHeatmap = memo(function ActivityHeatmap({ view, className }: ActivityHeatmapProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const ready = view.rows.length > 0;

  useEffect(() => {
    const node = scroller.current;
    if (ready && node) node.scrollLeft = node.scrollWidth;
  }, [ready]);

  return (
    <Section title={view.title} description={view.description} help={view.help} state={view.state} className={className}>
      <div className="flex min-w-0 flex-col gap-3">
        <p className="text-small text-fg-muted">
          {CAPTION}
          {view.peak ? (
            <>
              {' '}
              Your busiest day was <span className="font-medium text-fg">{view.peak.when}</span>, with{' '}
              <span className="font-mono text-fg">{view.peak.tokens}</span> effective tokens.
            </>
          ) : null}
        </p>
        <div ref={scroller} className="min-w-0 overflow-x-auto">
          <div role="group" aria-label={GRID_LABEL} className={GRID_CLASS}>
            <span aria-hidden="true" className={LABEL_CLASS} />
            {view.months.map((month, index) => (
              <span key={`month-${index}`} aria-hidden="true" className="h-4 truncate text-caption text-fg-subtle">
                {month}
              </span>
            ))}
            {view.rows.map((row) => (
              <Fragment key={row.key}>
                <span aria-hidden="true" className={cn('flex items-center text-caption text-fg-subtle', LABEL_CLASS)}>
                  {row.label}
                </span>
                {row.cells.map((cell) => (
                  <Tooltip key={cell.key} content={cell.label} delay={TOOLTIP_DELAY_MS}>
                    <span
                      role="img"
                      aria-label={cell.label}
                      className={cn(
                        'flex h-11 min-w-0 flex-col justify-between overflow-hidden rounded-tag p-1',
                        cell.future ? FUTURE_CLASS : HEAT_CLASS[cell.level],
                      )}
                    >
                      <span className="text-caption font-medium">{cell.day}</span>
                      {cell.tokens ? <span className="truncate font-mono text-mono tabular-nums">{cell.tokens}</span> : null}
                    </span>
                  </Tooltip>
                ))}
              </Fragment>
            ))}
          </div>
        </div>
        <div aria-hidden="true" className="flex items-center gap-1.5 text-caption text-fg-subtle">
          Less
          {HEAT_LEVELS.map((level) => (
            <span key={level} className={cn('h-3 w-4 rounded-[2px]', HEAT_CLASS[level])} />
          ))}
          More tokens per day
        </div>
      </div>
    </Section>
  );
});
