import { useState } from 'react';
import { compact } from '../lib/format';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function formatHour(h: number) {
  if (h === 0) return '12am';
  if (h < 12) return `${h}am`;
  if (h === 12) return '12pm';
  return `${h - 12}pm`;
}

export function PeakHoursHeatmap({ grid }: { grid: number[][] }) {
  const [tooltip, setTooltip] = useState<{ day: number; hour: number; value: number } | null>(null);

  // Find global max for intensity scaling
  const allValues = grid.flat();
  const maxVal = Math.max(...allValues, 1);

  function cellColor(value: number): string {
    if (value === 0) return 'rgba(38,38,47,0.5)';
    const intensity = value / maxVal;
    // Interpolate from dark clay to bright clay
    const alpha = 0.15 + intensity * 0.85;
    return `rgba(217,119,87,${alpha.toFixed(2)})`;
  }

  return (
    <div className="relative select-none">
      {/* Hour labels */}
      <div className="flex mb-1 ml-10">
        {HOURS.map((h) => (
          <div
            key={h}
            className="flex-1 text-center text-[9px] text-zinc-600 font-mono"
            style={{ minWidth: 0 }}
          >
            {h % 3 === 0 ? formatHour(h) : ''}
          </div>
        ))}
      </div>

      {/* Grid rows */}
      {grid.map((row, dayIdx) => (
        <div key={dayIdx} className="flex items-center mb-0.5">
          <div className="w-10 text-[10px] text-zinc-500 font-medium shrink-0">{DAYS[dayIdx]}</div>
          {row.map((value, hourIdx) => (
            <div
              key={hourIdx}
              className="flex-1 rounded-sm cursor-default transition-opacity"
              style={{
                height: 20,
                minWidth: 0,
                backgroundColor: cellColor(value),
                margin: '0 1px',
                outline: tooltip?.day === dayIdx && tooltip?.hour === hourIdx
                  ? '1px solid rgba(217,119,87,0.7)'
                  : undefined,
              }}
              onMouseEnter={() => setTooltip({ day: dayIdx, hour: hourIdx, value })}
              onMouseLeave={() => setTooltip(null)}
            />
          ))}
        </div>
      ))}

      {/* Tooltip */}
      {tooltip && tooltip.value > 0 && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-10 pointer-events-none
          rounded-lg border border-white/10 bg-ink-700 px-2.5 py-1.5 text-[11px] shadow-xl whitespace-nowrap">
          <span className="text-zinc-300 font-semibold">{DAYS[tooltip.day]}</span>
          <span className="text-zinc-500 mx-1">·</span>
          <span className="text-zinc-400">{formatHour(tooltip.hour)}</span>
          <span className="text-zinc-500 mx-1">·</span>
          <span className="text-clay-400 font-mono">{compact(tooltip.value)}</span>
        </div>
      )}

      {/* Legend */}
      <div className="mt-3 ml-10 flex items-center gap-2">
        <span className="text-[10px] text-zinc-600">Less</span>
        {[0.1, 0.3, 0.5, 0.7, 0.9].map((intensity) => (
          <div
            key={intensity}
            className="h-3 w-4 rounded-sm"
            style={{ backgroundColor: `rgba(217,119,87,${0.15 + intensity * 0.85})` }}
          />
        ))}
        <span className="text-[10px] text-zinc-600">More</span>
      </div>
    </div>
  );
}
