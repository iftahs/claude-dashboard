import { useEffect, useState } from 'react';
import { Section } from '@/components/design-system/molecules/Section/Section';
import { InfoTip } from '@/components/design-system/atoms/InfoTip/InfoTip';
import { Skeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
import type { StatCardProps } from '@/components/design-system/atoms/StatCard/types';
import { compact, usd, shortModel, dayLabel } from '@/lib/format';
import { modelColor } from '@/lib/palette';
import { useConfigMode } from '@/hooks/useConfigMode';
import { elapsedSec, formatElapsed, displayModel } from '@/components/design-system/organisms/AgentActivity/utils';
import type { WorkflowAgentInfo, WorkflowRun, WorkflowStats } from '@/types';
import type { WorkflowsViewProps, WorkflowCardProps } from './types';
import { buildPhaseGroups, defaultActivePhaseIndex, doneAgentCount, agentMetrics, groupRunsByDate } from './utils';
import type { PhaseGroup } from './utils';

/** "sourcesFetched" / "after_synthesis" → "Sources fetched" / "After synthesis". */
function humanize(key: string): string {
  const spaced = key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\b(url|api|id|mcp|ai)\b/gi, (m) => m.toUpperCase())
    .replace(/\s+/g, ' ')
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// ── Shared bits (mirror AgentActivity conventions) ──────────────────────────

function ElapsedTicker({ startedAt }: { startedAt: number }) {
  const [sec, setSec] = useState(() => elapsedSec(startedAt));
  useEffect(() => {
    const id = setInterval(() => setSec(elapsedSec(startedAt)), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return <span className="font-mono tabular-nums text-zinc-400">{formatElapsed(sec)}</span>;
}

/** Bare ticking "Ns" label (no wrapper styling) — used inside an agent metric tail. */
function LiveSeconds({ startedAt }: { startedAt: number }) {
  const [sec, setSec] = useState(() => elapsedSec(startedAt));
  useEffect(() => {
    const id = setInterval(() => setSec(elapsedSec(startedAt)), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return <span className="tabular-nums">{formatElapsed(sec)}</span>;
}

function ModelChip({ model }: { model: string }) {
  const isInherit = !model || model === 'inherit' || model === 'unknown';
  const color = isInherit ? '#71717a' : modelColor(model);
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ring-1 ring-white/10"
      style={{ backgroundColor: `${color}18` }}
    >
      <span className="h-1.5 w-1.5 rounded-full flex-none" style={{ backgroundColor: color }} />
      <span style={{ color }}>{displayModel(model || 'inherit')}</span>
    </span>
  );
}

function GroupLabel({ children }: { children: string }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 select-none">{children}</p>
  );
}

function CountChip({ count, label, pulse }: { count: number; label: string; pulse?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold tabular-nums text-zinc-300 ring-1 ring-white/10">
      {pulse && <span className="pulse-dot flex-none" />}
      {count} {label}
    </span>
  );
}

function StateDot({ state }: { state: WorkflowAgentInfo['state'] }) {
  if (state === 'done') return <span className="flex-none text-emerald-500">✓</span>;
  if (state === 'error') return <span className="flex-none text-red-500">✗</span>;
  if (state === 'stalled') return <span className="h-1.5 w-1.5 flex-none rounded-full bg-zinc-600" />;
  return <span className="pulse-dot flex-none" />;
}

// ── TUI: phases (left) + agents of the selected phase (right) ────────────────

/** One agent row in the right pane: state · label · model · "28.6K tok · 1 tool · 20s". */
function AgentTuiRow({ agent }: { agent: WorkflowAgentInfo }) {
  const running = agent.state === 'running';
  // When running, drop the static elapsed (override 0) and render a live ticker instead.
  const metrics = agentMetrics(agent, running ? 0 : undefined);
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 text-xs">
      <StateDot state={agent.state} />
      <span className="min-w-0 flex-1 truncate text-zinc-300" title={agent.label}>
        {agent.label || 'agent'}
      </span>
      <ModelChip model={agent.model} />
      <span className="flex-none tabular-nums text-[11px] text-zinc-500">
        {metrics}
        {running && (
          <>
            {metrics && ' · '}
            <LiveSeconds startedAt={agent.startedAt} />
          </>
        )}
      </span>
    </div>
  );
}

/** One phase row in the left pane: cursor · ✓/number · title · done/total. */
function PhaseRow({
  group,
  index,
  active,
  onSelect,
}: {
  group: PhaseGroup;
  index: number;
  active: boolean;
  onSelect: (i: number) => void;
}) {
  const complete = group.total > 0 && group.done === group.total;
  const started = group.total > 0;
  return (
    <button
      type="button"
      onClick={() => onSelect(index)}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs transition-colors ${
        active
          ? 'bg-ink-700 text-zinc-100 ring-1 ring-white/10'
          : 'text-zinc-400 hover:bg-ink-700/40 hover:text-zinc-200'
      }`}
    >
      <span className={`w-2 flex-none font-mono ${active ? 'text-clay-400' : 'text-transparent'}`}>›</span>
      <span className="w-4 flex-none text-center font-mono tabular-nums">
        {complete ? (
          <span className="text-emerald-500">✓</span>
        ) : (
          <span className="text-zinc-500">{index + 1}</span>
        )}
      </span>
      <span className="min-w-0 flex-1 truncate" title={group.title}>
        {group.title}
      </span>
      {started && (
        <span className="flex-none tabular-nums text-[11px] text-zinc-500">
          {group.done}/{group.total}
        </span>
      )}
    </button>
  );
}

/** Header line + bordered two-pane box mimicking Claude Code's `/workflows` view. */
function WorkflowTui({ run, hideHeader }: { run: WorkflowRun; hideHeader?: boolean }) {
  const groups = buildPhaseGroups(run);
  const autoIndex = defaultActivePhaseIndex(groups);
  const [selected, setSelected] = useState(autoIndex);
  const [pinned, setPinned] = useState(false);
  // Auto-follow the active phase on each poll until the user manually picks one.
  useEffect(() => {
    if (!pinned) setSelected(autoIndex);
  }, [autoIndex, pinned]);

  const safeIndex = Math.min(selected, Math.max(0, groups.length - 1));
  const sel = groups[safeIndex];
  const done = doneAgentCount(run);
  const accent = run.isLive || run.status === 'running' ? 'text-clay-400' : 'text-zinc-200';

  return (
    <div className="flex flex-col gap-1.5" style={{ animation: 'agent-enter 0.3s ease-out both' }}>
      {!hideHeader && (
        <div className="flex min-w-0 items-baseline gap-2 px-1">
          {run.isLive && <span className="pulse-dot flex-none self-center" />}
          <span className={`flex-none text-sm font-bold ${accent}`} title={run.name}>
            {run.name}
          </span>
          {run.summary && run.summary !== run.name && (
            <span className="min-w-0 flex-1 truncate text-xs text-zinc-500" title={run.summary}>
              {run.summary}
            </span>
          )}
          <span className="ml-auto flex-none font-mono text-[11px] tabular-nums text-zinc-500">
            {done}/{run.agentCount} agents{' · '}
            {run.isLive ? (
              <ElapsedTicker startedAt={run.startedAt} />
            ) : (
              formatElapsed(Math.floor(run.durationMs / 1000))
            )}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 overflow-hidden rounded-xl border border-white/10 bg-ink-800/60 sm:grid-cols-[minmax(11rem,16rem)_1fr]">
        {/* Left: phases */}
        <div className="flex flex-col gap-0.5 border-b border-white/10 p-2 sm:border-b-0 sm:border-r">
          <p className="px-2 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-600 select-none">
            Phases
          </p>
          {groups.length === 0 ? (
            <p className="px-2 py-1 text-xs text-zinc-600">No phases yet</p>
          ) : (
            groups.map((g, i) => (
              <PhaseRow
                key={`${g.title}-${i}`}
                group={g}
                index={i}
                active={i === safeIndex}
                onSelect={(idx) => {
                  setPinned(true);
                  setSelected(idx);
                }}
              />
            ))
          )}
        </div>

        {/* Right: agents of the selected phase */}
        <div className="flex min-w-0 flex-col p-2">
          {sel ? (
            <>
              <p className="px-1 pb-1 text-xs text-zinc-500">
                <span className="font-semibold text-zinc-300">{sel.title}</span>
                {' · '}
                {sel.agents.length} agent{sel.agents.length === 1 ? '' : 's'}
              </p>
              {sel.agents.length === 0 ? (
                <p className="px-1 py-3 text-xs text-zinc-600">
                  {sel.total === 0 ? 'Not started yet.' : 'No agents in this phase.'}
                </p>
              ) : (
                <div className="flex flex-col divide-y divide-white/10">
                  {sel.agents.map((a) => (
                    <AgentTuiRow key={a.agentId} agent={a} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="px-1 py-3 text-xs text-zinc-600">No agents yet.</p>
          )}
        </div>
      </div>

      {!hideHeader && run.isLive && (
        <p className="px-1 text-[10px] text-zinc-600 select-none">
          Click a phase to inspect its agents · {run.runningAgents} running
        </p>
      )}
    </div>
  );
}

// ── Recent workflow row ─────────────────────────────────────────────────────

const STATUS_PILL: Record<WorkflowRun['status'], string> = {
  completed: 'bg-emerald-500/10 text-emerald-400',
  failed: 'bg-red-500/10 text-red-400',
  running: 'bg-clay-500/15 text-clay-300',
  unknown: 'bg-zinc-700/40 text-zinc-400',
};

function RecentWorkflowRow({ run }: WorkflowCardProps) {
  const [open, setOpen] = useState(false);
  const ago = formatElapsed(elapsedSec(run.lastActivity));
  const hasDetail = run.agents.length > 0 || (run.logsTail?.length ?? 0) > 0;
  const showModel = run.defaultModel && run.defaultModel !== 'inherit' && run.defaultModel !== 'unknown';
  return (
    <div className="card flex flex-col gap-2 p-3.5">
      <div className="flex items-center gap-2 min-w-0">
        <span className="flex-none text-emerald-500">{run.status === 'completed' ? '✓' : '•'}</span>
        <span className="flex-1 truncate text-sm font-semibold text-zinc-200" title={run.summary || run.name}>
          {run.name}
        </span>
        {showModel && <ModelChip model={run.defaultModel} />}
        <span className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${STATUS_PILL[run.status]}`}>
          {run.status}
        </span>
        <span className="flex-none font-mono text-[11px] text-zinc-600">{ago} ago</span>
      </div>
      {run.summary && run.summary !== run.name && (
        <p className="truncate text-xs text-zinc-500" title={run.summary}>{run.summary}</p>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 tabular-nums">
        {run.project && <span className="text-zinc-600">{run.project}</span>}
        <span>{formatElapsed(Math.floor(run.durationMs / 1000))}</span>
        <span>{run.agentCount} agents</span>
        <span>{compact(run.tokens)} tok</span>
        {run.toolCalls > 0 && <span>{run.toolCalls} tool calls</span>}
        {run.phaseTotal != null && <span>{run.phaseTotal} phases</span>}
        {hasDetail && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="ml-auto rounded px-1.5 py-0.5 text-[11px] text-zinc-500 ring-1 ring-white/10 transition-colors hover:text-zinc-300 hover:ring-white/20"
          >
            {open ? '▾ Hide details' : '▸ Details'}
          </button>
        )}
      </div>
      {run.resultStats && (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(run.resultStats).map(([k, v]) => (
            <span key={k} className="rounded-md bg-ink-800/60 px-1.5 py-0.5 text-[10px] text-zinc-400 ring-1 ring-white/10">
              {humanize(k)}: <span className="text-zinc-300">{String(v)}</span>
            </span>
          ))}
        </div>
      )}
      {open && hasDetail && (
        <div className="mt-1 flex flex-col gap-2 border-t border-white/10 pt-2">
          {run.agents.length > 0 && <WorkflowTui run={run} hideHeader />}
          {run.logsTail && run.logsTail.length > 0 && (
            <div className="flex flex-col gap-1">
              <GroupLabel>Log</GroupLabel>
              <div className="rounded-lg bg-ink-900/60 px-2.5 py-1.5 font-mono text-[11px] leading-relaxed text-zinc-500 ring-1 ring-white/10">
                {run.logsTail.map((l, i) => (
                  <div key={i} className="truncate" title={l}>{l}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Compact stat tile (denser than the shared StatCard atom). */
function StatTile({ label, value, sub, accent, help }: StatCardProps) {
  return (
    <div className="card p-3">
      <div className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
        {help && <InfoTip text={help} />}
      </div>
      <div
        className="mt-1 text-lg font-bold leading-tight tabular-nums"
        style={accent ? { color: accent } : undefined}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[11px] text-zinc-400">{sub}</div>}
    </div>
  );
}

/** All-time summary tiles above the live/recent lists. */
function StatsGrid({ stats, loading }: { stats?: WorkflowStats | null; loading: boolean }) {
  if (loading && !stats) {
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="card p-3">
            <Skeleton className="h-2.5 w-16 rounded" />
            <Skeleton className="mt-2 h-5 w-12 rounded" />
          </div>
        ))}
      </div>
    );
  }
  if (!stats || stats.totalRuns === 0) return null;

  const dash = '—';
  const tiles: StatCardProps[] = [
    { label: 'Runs', value: compact(stats.totalRuns) },
    {
      label: 'Success rate',
      value: stats.completed + stats.failed > 0 ? `${Math.round(stats.successRate * 100)}%` : dash,
      accent: '#34d399',
      sub: `${stats.completed} ok · ${stats.failed} failed`,
    },
    { label: 'Total tokens', value: compact(stats.totalTokens) },
    { label: 'Agents spawned', value: compact(stats.totalAgents) },
    {
      label: 'Avg duration',
      value: stats.avgDurationMs > 0 ? formatElapsed(Math.round(stats.avgDurationMs / 1000)) : dash,
    },
    {
      label: 'Top model',
      value: stats.topModel && stats.topModel !== 'inherit' ? shortModel(stats.topModel) : dash,
    },
    {
      label: 'Est. cost',
      value: stats.estCostUsd > 0 ? `~${usd(stats.estCostUsd)}` : dash,
      accent: '#fbbf24',
      help: 'Rough equivalent-API estimate. Workflow journals store only combined effective tokens (no input/output split), so this is a blended approximation — not a real bill.',
    },
    { label: 'Tool calls', value: compact(stats.totalToolCalls) },
    {
      label: 'Busiest day',
      value: stats.busiestDay ? dayLabel(stats.busiestDay.day) : dash,
      sub: stats.busiestDay ? `${stats.busiestDay.count} run${stats.busiestDay.count === 1 ? '' : 's'}` : undefined,
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-3">
      {tiles.map((t) => (
        <StatTile key={t.label} {...t} />
      ))}
    </div>
  );
}

// ── Organism ────────────────────────────────────────────────────────────────

export function WorkflowsView({ data, loading, stats, statsLoading }: WorkflowsViewProps) {
  const { weekStart } = useConfigMode();
  const live = data?.live ?? [];
  const recent = data?.recent ?? [];
  const hasAny = live.length > 0 || recent.length > 0;

  return (
    <Section
      title="Workflows · live & recent"
      help="Dynamic workflow runs (the Workflow orchestration tool). Live runs show their phases and per-phase agents, tokens and elapsed time; recent runs list completed runs grouped by date. The stat strip aggregates every workflow run on disk. Mirrors what /workflows shows in Claude Code."
      right={live.length > 0 ? <CountChip count={live.length} label="running" pulse /> : undefined}
    >
      <div className="flex flex-col gap-4">
        <StatsGrid stats={stats} loading={statsLoading ?? false} />
        {loading && !data ? (
          <div className="h-10 flex items-center text-xs text-zinc-600">Loading…</div>
        ) : hasAny ? (
          <div className="flex flex-col gap-4">
            {live.length > 0 && (
              <div className="flex flex-col gap-4">
                <GroupLabel>Live</GroupLabel>
                {live.map((r) => (
                  <WorkflowTui key={r.runId} run={r} />
                ))}
              </div>
            )}
            {recent.length > 0 &&
              groupRunsByDate(recent, weekStart).map((bucket) => (
                <div key={bucket.label} className="flex flex-col gap-2">
                  <GroupLabel>{bucket.label}</GroupLabel>
                  {bucket.runs.map((r) => (
                    <RecentWorkflowRow key={r.runId} run={r} />
                  ))}
                </div>
              ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 py-8 text-center text-sm text-zinc-600">
            <span className="text-2xl">🔀</span>
            <p>No workflows yet.</p>
            <p className="text-xs text-zinc-700">
              Run one in Claude Code (e.g. a deep-research or multi-agent workflow) and it will appear here.
            </p>
          </div>
        )}
      </div>
    </Section>
  );
}
