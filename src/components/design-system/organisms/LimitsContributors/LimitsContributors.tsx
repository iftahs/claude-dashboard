import { useState } from 'react';
import { Section } from '@/components/design-system/molecules/Section/Section';
import { ToggleGroup } from '@/components/design-system/atoms/ToggleGroup/ToggleGroup';
import { ProgressBar } from '@/components/design-system/atoms/ProgressBar/ProgressBar';
import { usePolling } from '@/hooks/usePolling';
import { useSource } from '@/hooks/useSource';
import type { ContribRow, ContribWindow, ContributorsData } from '@/types';

type WindowKey = 'day' | 'week';

const RANGE_OPTIONS: { value: WindowKey; label: string }[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
];

const BREAKDOWNS: { key: keyof Pick<ContribWindow, 'skills' | 'subagents' | 'plugins' | 'mcpServers'>; label: string; color: string }[] = [
  { key: 'skills', label: 'Skills', color: '#f59e0b' },
  { key: 'subagents', label: 'Subagents', color: '#a78bfa' },
  { key: 'plugins', label: 'Plugins', color: '#22d3ee' },
  { key: 'mcpServers', label: 'MCP servers', color: '#10b981' },
];

function BreakdownTable({ label, rows, color }: { label: string; rows: ContribRow[]; color: string }) {
  if (!rows.length) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-zinc-500">
        <span>{label}</span>
        <span>% of usage</span>
      </div>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.name} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="truncate pr-2 text-zinc-300">{r.name}</span>
              <span className="font-mono tabular-nums text-zinc-400">{r.pct}%</span>
            </div>
            <ProgressBar pct={r.pct} color={color} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function LimitsContributors() {
  const { withSrc } = useSource();
  const { data } = usePolling<ContributorsData>(withSrc('/api/usage/contributors'), 60000);
  const [range, setRange] = useState<WindowKey>('day');

  if (!data) return null;
  const win = data[range];

  const hasBreakdowns = BREAKDOWNS.some(({ key }) => win[key].length > 0);
  // Nothing worth showing in either window → hide the whole panel.
  const dayEmpty = !data.day.behaviors.length && !BREAKDOWNS.some(({ key }) => data.day[key].length);
  const weekEmpty = !data.week.behaviors.length && !BREAKDOWNS.some(({ key }) => data.week[key].length);
  if (dayEmpty && weekEmpty) return null;

  return (
    <Section
      title="What's contributing to your limits usage?"
      help="Approximate, cost-weighted breakdown computed from local sessions on this machine — does not include other devices or claude.ai. These are independent characteristics of your usage, not a breakdown. Mirrors the Claude Code CLI usage view."
      right={<ToggleGroup options={RANGE_OPTIONS} value={range} onChange={setRange} />}
    >
      <p className="mb-4 text-[11px] text-zinc-500">
        {range === 'day' ? 'Last 24h' : 'Last 7d'} · approximate, based on local sessions on this machine
      </p>

      {/* Headline behaviors */}
      {win.behaviors.length ? (
        <div className="space-y-3">
          {win.behaviors.map((b) => (
            <div key={b.key} className="flex gap-2">
              <span className="mt-0.5 select-none text-clay-400">↗</span>
              <div>
                <p className="text-sm font-semibold text-zinc-200">{b.headline}</p>
                <p className="text-xs text-zinc-500">{b.body}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-zinc-500">Nothing over 10% in this period.</p>
      )}

      {/* Breakdown tables */}
      {hasBreakdowns && (
        <div className="mt-5 grid grid-cols-1 gap-5 border-t border-white/5 pt-5 sm:grid-cols-2">
          {BREAKDOWNS.map(({ key, label, color }) => (
            <BreakdownTable key={key} label={label} rows={win[key]} color={color} />
          ))}
        </div>
      )}
    </Section>
  );
}
