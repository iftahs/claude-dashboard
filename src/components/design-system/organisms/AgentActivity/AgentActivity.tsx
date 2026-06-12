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
  active,
  delegating,
}: {
  title: string;
  project: string;
  gitBranch: string;
  model: string;
  lastActivity: number;
  effectiveTokens: number;
  active: boolean;
  delegating: boolean;
}) {
  // Three states: working on its own transcript, delegating to running subagents, or idle.
  const working = active || delegating;
  return (
    <div
      className={`card flex flex-col gap-2 p-4 border transition-all duration-500 ${
        working ? 'border-clay-500/15' : 'border-white/5 opacity-60 saturate-50'
      }`}
      style={{ animation: 'agent-enter 0.3s ease-out both' }}
    >
      <div className="flex items-center gap-2 min-w-0">
        {working ? (
          <span className="pulse-dot flex-none" />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-zinc-600 flex-none" />
        )}
        <span className="text-sm flex-none select-none">🖥</span>
        <span className="font-semibold text-zinc-100 text-sm truncate flex-1" title={title}>
          {title}
        </span>
        {delegating && (
          <span className="flex-none rounded-full bg-indigo-500/10 text-indigo-300 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
            Delegating
          </span>
        )}
        {!working && (
          <span className="flex-none rounded-full bg-zinc-700/40 text-zinc-400 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
            Not Active
          </span>
        )}
        <ActiveAgoTicker lastActivity={lastActivity} />
      </div>

      <p className="text-xs text-zinc-500 truncate">
        {project}
        {gitBranch && <span className="text-zinc-600 font-mono"> · {gitBranch}</span>}
      </p>

      {working && <WorkingBar />}

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

  // Group subagents under their parent session; anything whose parent isn't shown
  // (rotated/compacted away) falls back to a flat "Other subagents" group.
  const mainKeys = new Set(mains.map((m) => m.key));
  const orphanRunning = running.filter((r) => !mainKeys.has(r.parentKey));
  const orphanCompleted = completed.filter((c) => !mainKeys.has(c.parentKey));

  return (
    <Section
      title="Agents · live activity"
      help="Live view of agents working right now: main agents, their running subagents (Task/Agent spawns), and recently finished ones — refreshed every few seconds from active session logs. Empty when nothing is running."
    >
      {loading && !data ? (
        <div className="h-10 flex items-center text-xs text-zinc-600">Loading…</div>
      ) : hasActivity ? (
        <div className="flex flex-col gap-4">
          {/* Main Claude Code sessions, each with its subagents nested beneath */}
          {mains.length > 0 && <GroupLabel>Main sessions</GroupLabel>}
          {mains.map((m) => {
            const kids = running.filter((r) => r.parentKey === m.key);
            const done = completed.filter((c) => c.parentKey === m.key);
            return (
              <div key={m.key} className="flex flex-col gap-2">
                <MainAgentCard
                  title={m.title}
                  project={m.project}
                  gitBranch={m.gitBranch}
                  model={m.model}
                  lastActivity={m.lastActivity}
                  effectiveTokens={m.effectiveTokens}
                  active={m.active}
                  delegating={m.delegating}
                />
                {(kids.length > 0 || done.length > 0) && (
                  <div className="ml-3 flex flex-col gap-2 border-l border-white/10 pl-3 sm:ml-4 sm:pl-4">
                    <GroupLabel>Subagents</GroupLabel>
                    {kids.length > 0 && (
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {kids.map((agent) => (
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
                    )}
                    {done.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        {done.map((c) => (
                          <CompletedRow
                            key={c.key}
                            name={c.name}
                            description={c.description}
                            model={c.model}
                            completedAt={c.completedAt}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Subagents whose parent session isn't shown */}
          {(orphanRunning.length > 0 || orphanCompleted.length > 0) && (
            <div className="flex flex-col gap-2">
              <GroupLabel>{mains.length > 0 ? 'Other subagents' : 'Subagents'}</GroupLabel>
              {orphanRunning.length > 0 && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {orphanRunning.map((agent) => (
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
              )}
              {orphanCompleted.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  {orphanCompleted.map((c) => (
                    <CompletedRow
                      key={c.key}
                      name={c.name}
                      description={c.description}
                      model={c.model}
                      completedAt={c.completedAt}
                    />
                  ))}
                </div>
              )}
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
