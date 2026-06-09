import { Fragment } from 'react';
import type { DailyActivity } from '../types';
import { compact } from '../lib/format';

const WEEKS = 18; // ~4 months
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['', 'Mon', '', 'Wed', '', 'Fri', '']; // rows Sun..Sat, label odd rows

function localKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function color(tokens: number, max: number): string {
  if (tokens === 0) return '#1b1b22';
  const t = Math.min(1, Math.sqrt(tokens / Math.max(1, max)));
  const a = 0.2 + t * 0.8;
  return `rgba(217, 119, 87, ${a.toFixed(2)})`;
}

export function ActivityHeatmap({ days }: { days: DailyActivity[] }) {
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
        Each square is one day · darker = more effective tokens used. Numbers represent day of month, messages count (m), effective tokens, and tool calls (t).
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
                {columns.map((col) => {
                  const cell = col[rowIndex];
                  const isFutureDay = isFuture(cell.date);
                  const d = new Date(cell.date + 'T00:00:00');
                  const dayNum = d.getDate();
                  const hasActivity = cell.effectiveTokens > 0;
                  return (
                    <div
                      key={cell.date}
                      title={`${cell.date} · ${compact(cell.effectiveTokens)} tokens · ${cell.messageCount} msgs · ${cell.toolCallCount} tool calls`}
                      className="relative flex flex-col justify-between p-1.5 rounded-md transition-all duration-300 aspect-square select-none text-left border"
                      style={{
                        background: isFutureDay ? 'transparent' : color(cell.effectiveTokens, max),
                        borderColor: isFutureDay ? '#27272a' : 'rgba(255,255,255,0.05)',
                        borderStyle: isFutureDay ? 'dashed' : 'solid',
                      }}
                    >
                      <div className="flex justify-between items-start">
                        <span className={`text-[10px] font-extrabold leading-none ${hasActivity ? 'text-white' : 'text-zinc-600'}`}>
                          {dayNum}
                        </span>
                        {hasActivity && cell.messageCount > 0 && (
                          <span className="text-[8px] text-zinc-300 opacity-90 font-mono leading-none">
                            {cell.messageCount}m
                          </span>
                        )}
                      </div>
                      {hasActivity ? (
                        <div className="mt-auto flex flex-col leading-none">
                          <span className="text-[10px] font-black text-white font-mono leading-tight">
                            {compact(cell.effectiveTokens)}
                          </span>
                          {cell.toolCallCount > 0 && (
                            <span className="text-[7px] text-zinc-200/90 font-mono mt-0.5 leading-none">
                              {cell.toolCallCount}t
                            </span>
                          )}
                        </div>
                      ) : null}
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
