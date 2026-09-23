import { useState } from 'react';
import { Section } from '@/components/design-system/molecules/Section/Section';
import { ToggleGroup } from '@/components/design-system/atoms/ToggleGroup/ToggleGroup';
import { ProgressBar } from '@/components/design-system/atoms/ProgressBar/ProgressBar';
import { usePolling } from '@/hooks/usePolling';
import { useSource } from '@/hooks/useSource';
import { PLATFORM_NOUN, titleScope } from '@/lib/platform';
import type { ContributorsData } from '@/types';
import type { BreakdownTableProps, ContribWindowKey, LimitsContributorsProps } from './types';
import { BREAKDOWNS, CLAUDE_HELP, CODEX_HELP, RANGE_OPTIONS, agentName } from './utils';

function BreakdownTable({ label, rows, color, nameOf = (n) => n }: BreakdownTableProps) {
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
              <span className="truncate pr-2 text-zinc-300">{nameOf(r.name)}</span>
              <span className="font-mono tabular-nums text-zinc-400">{r.pct}%</span>
            </div>
            <ProgressBar pct={r.pct} color={color} />
          </div>
        ))}
      </div>
    </div>
  );
}

// Cost-weighted (Claude Code CLI wording) or effective-token-weighted (Codex) — the server picks based on scope.
export function LimitsContributors({ source, showEmpty = false }: LimitsContributorsProps) {
  const { withSrc, platform } = useSource();
  const url = source ? `/api/usage/contributors?source=${source}` : withSrc('/api/usage/contributors');
  const { data } = usePolling<ContributorsData>(url, 60000);
  const [range, setRange] = useState<ContribWindowKey>('day');

  if (!data) return null;
  const win = data[range];
  const codex = source ? source === 'codex' : platform === 'codex';

  const hasBreakdowns = BREAKDOWNS.some(({ key }) => win[key].length > 0);
  // Nothing worth showing → hide the panel, unless a side-by-side pair needs the card to hold its place.
  const dayEmpty = !data.day.behaviors.length && !BREAKDOWNS.some(({ key }) => data.day[key].length);
  const weekEmpty = !data.week.behaviors.length && !BREAKDOWNS.some(({ key }) => data.week[key].length);
  if (dayEmpty && weekEmpty && !showEmpty) return null;

  // An explicit scope always names its platform (Both shows the two side by side).
  const scope = source ? ` · ${PLATFORM_NOUN[source]}` : titleScope(platform);
  const where = codex ? 'local rollouts on this machine' : 'local sessions on this machine';

  return (
    <Section
      title={`What's contributing to your limits usage?${scope}`}
      help={codex ? CODEX_HELP : CLAUDE_HELP}
      right={<ToggleGroup options={RANGE_OPTIONS} value={range} onChange={setRange} />}
    >
      <p className="mb-4 text-[11px] text-zinc-500">
        {range === 'day' ? 'Last 24h' : 'Last 7d'} · approximate, based on {where}
        {data.weight === 'effectiveTokens' ? ' · weighted by effective tokens' : ''}
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
            <BreakdownTable
              key={key}
              label={codex && key === 'subagents' ? 'Auto-reviews & subagents' : label}
              rows={win[key]}
              color={color}
              nameOf={key === 'subagents' ? agentName : undefined}
            />
          ))}
        </div>
      )}
    </Section>
  );
}
