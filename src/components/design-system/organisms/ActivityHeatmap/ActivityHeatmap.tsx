import { Fragment, useState } from 'react';
import { HoverTooltip } from '@/components/design-system/molecules/HoverTooltip/HoverTooltip';
import type { DailyActivity } from '@/types';
import { compact } from '@/lib/format';
import type { ActivityHeatmapProps } from './types';
import { MONTHS, WEEKDAYS, WEEKS, color, localKey } from './utils';

export function ActivityHeatmap({ days }: ActivityHeatmapProps) {
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);

  const byDate = new Map(days.map((d) => [d.date, d]));
  const max = days.reduce((m, d) => Math.max(m, d.effectiveTokens), 0);

  // Grid of the last WEEKS*7 days, columns = weeks (Sun-start), rows = weekday.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setDate(end.getDate() + (6 - end.getDay())); // end of current week (Sat)
  const totalDays = WEEKS * 7;

  const cells: DailyActivity[] = [];
  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    const key = localKey(d);
    cells.push(
      byDate.get(key) ?? { date: key, effectiveTokens: 0, messageCount: 0, toolCallCount: 0 }
    );
  }

  const columns: DailyActivity[][] = [];
  for (let w = 0; w < WEEKS; w++) columns.push(cells.slice(w * 7, w * 7 + 7));

  // Month label above a column when its first in-range day starts a new month.
  const monthLabels = columns.map((col, ci) => {
    const firstReal = col[0];
    const month = new Date(firstReal.date + 'T00:00:00').getMonth();
    const prevMonth =
      ci === 0 ? -1 : new Date(columns[ci - 1][0].date + 'T00:00:00').getMonth();
    return month !== prevMonth ? MONTHS[month] : '';
  });

  const isFuture = (key: string) => key > localKey(today);

  return (
    <div>
      <p className="mb-4 text-xs text-zinc-500">
        Each square is one day · darker = more effective tokens used. Numbers show day of month and effective tokens; hover a square for details.
      </p>
      <div className="overflow-x-auto">
        <div className="grid grid-cols-[auto_repeat(18,1fr)] gap-1.5 w-full min-w-[900px]">
          {/* Row 0: Month labels */}
          <div /> {/* Top left cell is empty */}
          {monthLabels.map((m, ci) => (
            <div key={ci} className="text-[10px] font-bold text-zinc-500 pb-1 text-left truncate select-none">
              {m}
            </div>
          ))}

          {/* Rows 1-7: Weekdays */}
          {Array.from({ length: 7 }).map((_, rowIndex) => {
            const weekdayLabel = WEEKDAYS[rowIndex];
            return (
              <Fragment key={rowIndex}>
                <div className="text-[10px] font-bold text-zinc-500 pr-2 flex items-center justify-end h-full min-w-[28px] select-none">
                  {weekdayLabel}
                </div>
                {columns.map((col, ci) => {
                  const cell = col[rowIndex];
                  const isFutureDay = isFuture(cell.date);
                  const d = new Date(cell.date + 'T00:00:00');
                  const dayNum = d.getDate();
                  const hasActivity = cell.effectiveTokens > 0;
                  const isHovered = hoveredDate === cell.date;
                  const tooltipPosition = rowIndex === 0 ? 'below' : 'above';
                  // Anchor edge columns so the nowrap tooltip stays inside the scroll container.
                  const tooltipAlign = ci >= WEEKS - 2 ? 'right' : ci <= 1 ? 'left' : 'center';
                  return (
                    <div
                      key={cell.date}
                      className="relative flex flex-col justify-between p-1.5 rounded-md transition-all duration-300 aspect-square select-none text-left border"
                      style={{
                        background: isFutureDay ? 'transparent' : color(cell.effectiveTokens, max),
                        borderColor: isFutureDay ? '#27272a' : 'rgba(255,255,255,0.05)',
                        borderStyle: isFutureDay ? 'dashed' : 'solid',
                      }}
                      onMouseEnter={() => setHoveredDate(cell.date)}
                      onMouseLeave={() => setHoveredDate(null)}
                    >
                      <div className="flex justify-between items-start">
                        <span className={`text-[10px] font-extrabold leading-none ${hasActivity ? 'text-white' : 'text-zinc-600'}`}>
                          {dayNum}
                        </span>
                      </div>
                      {hasActivity ? (
                        <div className="mt-auto flex flex-col leading-none">
                          <span className="text-[10px] font-black text-white font-mono leading-tight">
                            {compact(cell.effectiveTokens)}
                          </span>
                        </div>
                      ) : null}
                      {isHovered && (
                        <HoverTooltip position={tooltipPosition} align={tooltipAlign}>
                          <span className="text-zinc-300">{cell.date}</span>
                          <span className="text-zinc-500 mx-1">·</span>
                          <span className="text-zinc-300">{compact(cell.effectiveTokens)} tokens</span>
                          <span className="text-zinc-500 mx-1">·</span>
                          <span className="text-zinc-300">{cell.messageCount} msgs</span>
                          <span className="text-zinc-500 mx-1">·</span>
                          <span className="text-zinc-300">{cell.toolCallCount} tools</span>
                        </HoverTooltip>
                      )}
                    </div>
                  );
                })}
              </Fragment>
            );
          })}
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
        <span>less</span>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <span
            key={t}
            className="h-3 w-3 rounded-sm"
            style={{ background: t === 0 ? '#1b1b22' : `rgba(217,119,87,${0.2 + t * 0.8})` }}
          />
        ))}
        <span>more tokens/day</span>
      </div>
    </div>
  );
}
