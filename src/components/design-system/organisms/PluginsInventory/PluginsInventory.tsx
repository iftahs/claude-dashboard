import type { ReactNode } from 'react';
import type { PluginsInventoryProps } from './types';

function Chip({ children, tone = 'zinc' }: { children: ReactNode; tone?: 'zinc' | 'clay' | 'indigo' }) {
  const cls =
    tone === 'clay'
      ? 'bg-clay-500/15 text-clay-300'
      : tone === 'indigo'
        ? 'bg-indigo-500/15 text-indigo-300'
        : 'bg-ink-800/60 text-zinc-300 ring-1 ring-white/10';
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${cls}`}>{children}</span>;
}

function Group({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-semibold text-zinc-300">{title}</span>
        <span className="text-xs text-zinc-600 tabular-nums">{count}</span>
      </div>
      {count > 0 ? <div className="flex flex-wrap gap-1.5">{children}</div> : <p className="text-xs text-zinc-600">None</p>}
    </div>
  );
}

export function PluginsInventory({ data }: PluginsInventoryProps) {
  if (!data) return <div className="text-sm text-zinc-500">Loading…</div>;
  return (
    <div className="space-y-5">
      {(data.model || data.effortLevel) && (
        <div className="flex flex-wrap gap-1.5">
          {data.model && <Chip tone="clay">model: {data.model}</Chip>}
          {data.effortLevel && <Chip>effort: {data.effortLevel}</Chip>}
        </div>
      )}

      <Group title="MCP servers" count={data.mcpServers.length}>
        {data.mcpServers.map((m) => (
          <Chip key={m.name} tone={m.scope === 'global' ? 'indigo' : 'zinc'}>
            {m.name}
            <span className="text-[10px] opacity-60">{m.scope}</span>
          </Chip>
        ))}
      </Group>

      <Group title="Installed plugins" count={data.plugins.length}>
        {data.plugins.map((p) => (
          <Chip key={`${p.name}@${p.marketplace}`}>
            {p.name}
            {p.marketplace && <span className="text-[10px] opacity-60">@{p.marketplace}</span>}
          </Chip>
        ))}
      </Group>

      <Group title="Marketplaces" count={data.marketplaces.length}>
        {data.marketplaces.map((m) => (
          <Chip key={m}>{m}</Chip>
        ))}
      </Group>

      {data.hooks.length > 0 && (
        <Group title="Hooks" count={data.hooks.length}>
          {data.hooks.map((h) => (
            <Chip key={h}>{h}</Chip>
          ))}
        </Group>
      )}
    </div>
  );
}
