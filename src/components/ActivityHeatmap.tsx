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
      <p className="mb-3 text-xs text-zinc-500">
        Each square is one day · darker = more effective tokens used. Hover for detail.
      </p>
      <div className="overflow-x-auto">
        <div className="flex gap-1">
          {/* weekday labels */}
          <div className="mr-1 flex flex-col gap-1 pt-[18px] text-[9px] leading-3 text-zinc-600">
            {WEEKDAYS.map((w, i) => (
              <span key={i} className="h-3 w-6 text-right">
                {w}
              </span>
            ))}
          </div>
          {columns.map((col, ci) => (
            <div key={ci} className="flex flex-col gap-1">
              <span className="h-[14px] text-[9px] leading-3 text-zinc-600">
                {monthLabels[ci]}
              </span>
              {col.map((cell) => (
                <div
                  key={cell.date}
                  title={
                    isFuture(cell.date)
                      ? cell.date
                      : `${cell.date} · ${compact(cell.effectiveTokens)} tokens · ${cell.messageCount} msgs · ${cell.toolCallCount} tool calls`
                  }
                  className="h-3 w-3 rounded-sm"
                  style={{
                    background: isFuture(cell.date) ? 'transparent' : color(cell.effectiveTokens, max),
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
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
