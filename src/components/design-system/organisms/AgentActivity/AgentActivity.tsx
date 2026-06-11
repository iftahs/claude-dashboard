import { useEffect, useState } from 'react';
import { Section } from '@/components/design-system/molecules/Section/Section';
import { compact } from '@/lib/format';
import { modelColor } from '@/lib/palette';
import type { AgentActivityProps } from './types';
import { elapsedSec, formatElapsed, displayModel } from './utils';

// ── Ticking elapsed label ──────────────────────────────────────────────────

function ElapsedTicker({ startedAt }: { startedAt: number }) {
  const [sec, setSec] = useState(() => elapsedSec(startedAt));
  useEffect(() => {
    const id = setInterval(() => setSec(elapsedSec(startedAt)), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return <span className="font-mono tabular-nums text-zinc-400">{formatElapsed(sec)}</span>;
}

// ── Model chip ─────────────────────────────────────────────────────────────

function ModelChip({ model }: { model: string }) {
  const isInherit = !model || model === 'inherit' || model === 'unknown';
  const color = isInherit ? '#71717a' : modelColor(model);
  const label = displayModel(model || 'inherit');
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ring-1 ring-white/10"
      style={{ backgroundColor: `${color}18` }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full flex-none"
        style={{ backgroundColor: color }}
      />
      <span style={{ color }}>{label}</span>
    </span>
  );
}

// ── Indeterminate progress bar (agent-sweep keyframe) ─────────────────────

function WorkingBar() {
  return (
    <div className="relative h-0.5 w-full overflow-hidden rounded-full bg-white/5">
      <div
        className="absolute inset-y-0 w-1/3 rounded-full"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(217,119,87,0.7), transparent)',
          animation: 'agent-sweep 1.8s ease-in-out infinite',
        }}
      />
    </div>
  );
}

// ── Running agent card ─────────────────────────────────────────────────────

function RunningCard({
  name,
  description,
  model,
  startedAt,
  effectiveTokens,
}: {
  name: string;
  description: string;
  model: string;
  startedAt: number;
  effectiveTokens: number;
}) {
  return (
    <div
      className="card flex flex-col gap-2 p-4"
      style={{ animation: 'agent-enter 0.3s ease-out both' }}
    >
      {/* Top row: status dot + name */}
      <div className="flex items-center gap-2 min-w-0">
        <span className="pulse-dot flex-none" />
        <span className="font-semibold text-zinc-100 text-sm truncate flex-1" title={name}>
          {name || 'agent'}
        </span>
        <ElapsedTicker startedAt={startedAt} />
      </div>

      {/* Description */}
      {description && (
        <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2" title={description}>
          {description}
        </p>
      )}

      {/* Working bar */}
      <WorkingBar />

      {/* Bottom row: model chip + tokens */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <ModelChip model={model} />
        {effectiveTokens > 0 && (
          <span className="text-xs text-zinc-500 tabular-nums">
            {compact(effectiveTokens)} tok
          </span>
        )}
      </div>
    </div>
  );
}

// ── Recently completed row ─────────────────────────────────────────────────

function CompletedRow({
  name,
  description,
  model,
  completedAt,
}: {
  name: string;
  description: string;
  model: string;
  completedAt: number;
}) {
  const sec = Math.max(0, Math.floor((Date.now() - completedAt) / 1000));
  return (
    <div
      className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs"
      style={{
        backgroundColor: 'rgba(16,185,129,0.04)',
        border: '1px solid rgba(16,185,129,0.1)',
        animation: 'agent-fade-out 4s ease-in 1s both',
      }}
    >
      <span className="text-emerald-500 flex-none">✓</span>
      <span className="font-semibold text-zinc-400 truncate">{name || 'agent'}</span>
      {description && (
        <span className="text-zinc-600 truncate flex-1 hidden sm:block">{description}</span>
      )}
      <ModelChip model={model} />
      <span className="bg-emerald-500/10 text-emerald-400 rounded-full px-2 py-0.5 text-xs font-semibold flex-none">
        done
      </span>
      <span className="text-zinc-600 font-mono flex-none">{sec}s ago</span>
    </div>
  );
}

// ── Main session card ───────────────────────────────────────────────────────

function ActiveAgoTicker({ lastActivity }: { lastActivity: number }) {
  const [sec, setSec] = useState(() => elapsedSec(lastActivity));
  useEffect(() => {
    const id = setInterval(() => setSec(elapsedSec(lastActivity)), 1000);
    return () => clearInterval(id);
  }, [lastActivity]);
  return (
    <span className="font-mono tabular-nums text-zinc-500 text-xs">active {formatElapsed(sec)} ago</span>
  );
}

function MainAgentCard({
  title,
  project,
  gitBranch,
  model,
  lastActivity,
  effectiveTokens,
}: {
  title: string;
  project: string;
  gitBranch: string;
  model: string;
  lastActivity: number;
  effectiveTokens: number;
}) {
  return (
    <div
      className="card flex flex-col gap-2 p-4 border border-clay-500/15"
      style={{ animation: 'agent-enter 0.3s ease-out both' }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="pulse-dot flex-none" />
        <span className="text-sm flex-none select-none">🖥</span>
        <span className="font-semibold text-zinc-100 text-sm truncate flex-1" title={title}>
          {title}
        </span>
        <ActiveAgoTicker lastActivity={lastActivity} />
      </div>

      <p className="text-xs text-zinc-500 truncate">
        {project}
        {gitBranch && <span className="text-zinc-600 font-mono"> · {gitBranch}</span>}
      </p>

      <WorkingBar />

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <ModelChip model={model} />
        {effectiveTokens > 0 && (
          <span className="text-xs text-zinc-500 tabular-nums">{compact(effectiveTokens)} tok</span>
        )}
      </div>
    </div>
  );
}

// ── Main organism ──────────────────────────────────────────────────────────

function GroupLabel({ children }: { children: string }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 select-none">{children}</p>
  );
}

export function AgentActivity({ data, loading }: AgentActivityProps) {
  const running = data?.running ?? [];
  const completed = data?.recentlyCompleted ?? [];
  const mains = data?.mainAgents ?? [];
  const hasActivity = running.length > 0 || completed.length > 0 || mains.length > 0;

  return (
    <Section title="Agents · live activity">
      {loading && !data ? (
        <div className="h-10 flex items-center text-xs text-zinc-600">Loading…</div>
      ) : hasActivity ? (
        <div className="flex flex-col gap-3">
          {/* Main Claude Code sessions */}
          {mains.length > 0 && (
            <>
              <GroupLabel>Main sessions</GroupLabel>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {mains.map((m) => (
                  <MainAgentCard
                    key={m.key}
                    title={m.title}
                    project={m.project}
                    gitBranch={m.gitBranch}
                    model={m.model}
                    lastActivity={m.lastActivity}
                    effectiveTokens={m.effectiveTokens}
                  />
                ))}
              </div>
            </>
          )}

          {/* Running subagent cards */}
          {running.length > 0 && (
            <>
              {mains.length > 0 && <GroupLabel>Subagents</GroupLabel>}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {running.map((agent) => (
                  <RunningCard
                    key={agent.key}
                    name={agent.name}
                    description={agent.description}
                    model={agent.model}
                    startedAt={agent.startedAt}
                    effectiveTokens={agent.effectiveTokens}
                  />
                ))}
              </div>
            </>
          )}

          {/* Recently completed rows */}
          {completed.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {completed.map((c, i) => (
                <CompletedRow
                  key={`${c.name}-${c.completedAt}-${i}`}
                  name={c.name}
                  description={c.description}
                  model={c.model}
                  completedAt={c.completedAt}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 py-1 text-xs text-zinc-600">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-zinc-700 flex-none" />
          No agents running right now
        </div>
      )}
    </Section>
  );
}
