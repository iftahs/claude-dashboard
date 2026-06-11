import { useState } from 'react';
import { HoverTooltip } from '@/components/design-system/molecules/HoverTooltip/HoverTooltip';
import { compact } from '@/lib/format';
import type { PeakHoursHeatmapProps } from './types';
import { DAYS, HOURS, formatHour } from './utils';

export function PeakHoursHeatmap({ grid }: PeakHoursHeatmapProps) {
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
              className="relative flex-1 rounded-sm cursor-default transition-opacity"
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
            >
              {tooltip?.day === dayIdx && tooltip?.hour === hourIdx && value > 0 && (
                <HoverTooltip
                  position="above"
                  align={hourIdx >= HOURS.length - 3 ? 'right' : hourIdx <= 2 ? 'left' : 'center'}
                >
                  <span className="text-zinc-300 font-semibold">{DAYS[dayIdx]}</span>
                  <span className="text-zinc-500 mx-1">·</span>
                  <span className="text-zinc-400">{formatHour(hourIdx)}</span>
                  <span className="text-zinc-500 mx-1">·</span>
                  <span className="text-clay-400 font-mono">{compact(value)}</span>
                </HoverTooltip>
              )}
            </div>
          ))}
        </div>
      ))}

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
