import type { ReactNode } from 'react';
import { PLATFORM_NOUN } from '@/lib/platform';
import type { WorkspacePlatform } from '@/types';
import type { PluginsInventoryProps } from './types';

function Chip({
  children,
  tone = 'zinc',
  dim = false,
  title,
}: {
  children: ReactNode;
  tone?: 'zinc' | 'clay' | 'indigo';
  dim?: boolean;
  title?: string;
}) {
  const cls =
    tone === 'clay'
      ? 'bg-clay-500/15 text-clay-300'
      : tone === 'indigo'
        ? 'bg-indigo-500/15 text-indigo-300'
        : 'bg-ink-800/60 text-zinc-300 ring-1 ring-white/10';
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${cls} ${dim ? 'opacity-50' : ''}`} title={title}>
      {children}
    </span>
  );
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

/** Which platform an item came from — only a merged (Both) inventory tags its items. */
function Tag({ platform }: { platform?: WorkspacePlatform }) {
  return platform ? <span className="text-[10px] opacity-60">{PLATFORM_NOUN[platform]}</span> : null;
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
          <Chip
            key={`${m.platform ?? ''}:${m.name}`}
            tone={m.scope === 'global' ? 'indigo' : 'zinc'}
            title={m.command ? `${m.name} — launches ${m.command}` : undefined}
          >
            {m.name}
            <span className="text-[10px] opacity-60">{m.scope}</span>
            <Tag platform={m.platform} />
          </Chip>
        ))}
      </Group>

      <Group title="Installed plugins" count={data.plugins.length}>
        {data.plugins.map((p) => (
          <Chip
            key={`${p.platform ?? ''}:${p.name}@${p.marketplace}`}
            dim={p.enabled === false}
            title={p.enabled === false ? `${p.name} is installed but turned off` : undefined}
          >
            {p.name}
            {p.marketplace && <span className="text-[10px] opacity-60">@{p.marketplace}</span>}
            {p.enabled === false && <span className="text-[10px] opacity-60">off</span>}
            <Tag platform={p.platform} />
          </Chip>
        ))}
      </Group>

      <Group title="Marketplaces" count={data.marketplaces.length}>
        {data.marketplaces.map((m) => (
          <Chip key={m}>{m}</Chip>
        ))}
      </Group>

      {data.skills && (
        <Group title="Skills" count={data.skills.length}>
          {data.skills.map((s) => (
            <Chip key={`${s.platform ?? ''}:${s.system ? '.' : ''}${s.name}`} title={s.system ? 'Bundled with the app' : undefined}>
              {s.name}
              {s.system && <span className="text-[10px] opacity-60">bundled</span>}
              <Tag platform={s.platform} />
            </Chip>
          ))}
        </Group>
      )}

      {data.automations && data.automations.length > 0 && (
        <Group title="Automations" count={data.automations.length}>
          {data.automations.map((a) => (
            <Chip
              key={`${a.platform ?? ''}:${a.name}`}
              dim={a.status !== '' && a.status !== 'active'}
              title={a.status ? `${a.name} — ${a.status}` : a.name}
            >
              {a.name}
              <span className="text-[10px] opacity-60">{a.schedule}</span>
              <Tag platform={a.platform} />
            </Chip>
          ))}
        </Group>
      )}

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
