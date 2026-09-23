import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import { InfoTip } from '@/components/design-system/atoms/InfoTip/InfoTip';
import { Skeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
import type { ConfigProfileProps } from './types';
import { TONE_CLASS } from './utils';

/**
 * The active settings of one coding agent — Claude Code or Codex — in one card:
 * six headline tiles, four switches, the integration counts and two lists. The
 * platform decides the content (see claudeProfileView / codexProfileView), never
 * the layout.
 */
export function ConfigProfile({ profile }: ConfigProfileProps) {
  if (!profile) {
    return (
      <div className="card flex flex-col gap-3 p-5">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="card p-5 flex flex-col">
      <div className="mb-4 flex-none">
        <h3 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-zinc-300">
          {profile.title}
          <InfoTip text={profile.help} />
        </h3>
        <p className="text-xs text-zinc-500 mt-0.5">{profile.subtitle}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4 flex-none">
        {profile.tiles.map((t) => (
          <div key={t.label} className="rounded-xl bg-ink-700/50 p-3 border border-white/10">
            <span className="text-[11px] text-zinc-500 uppercase tracking-wider block mb-0.5">{t.label}</span>
            <span
              className={`text-sm font-semibold font-mono truncate block ${TONE_CLASS[t.tone]} ${t.capitalize ? 'capitalize' : ''}`}
              title={t.title ?? t.value}
            >
              {t.value}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-4 text-xs flex-none">
        {profile.flags.map((f) => (
          <div key={f.label} className="flex justify-between items-center gap-2 py-1.5 border-b border-white/10">
            <span className="text-zinc-400">{f.label}</span>
            <Badge variant={f.variant}>{f.value}</Badge>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-4 text-[11px] flex-none">
        {profile.counts.map((c) => (
          <span key={c.label} className="rounded-lg bg-ink-700/50 border border-white/10 px-2.5 py-1 text-zinc-400">
            {c.label} <span className="font-semibold text-zinc-200">{c.value}</span>
          </span>
        ))}
      </div>

      <div className="space-y-4">
        {profile.lists.map((l) => (
          <div key={l.title} className="flex flex-col">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5 block">
              {l.title} ({l.count ?? l.items.length})
            </span>
            <div className="overflow-y-auto max-h-[200px] pr-1 scrollbar-thin divide-y divide-white/10 border border-white/10 rounded-xl bg-ink-700/30 p-2 text-xs">
              {l.items.length > 0 ? (
                l.items.map((item, idx) => (
                  <div key={idx} className="py-1.5 font-mono text-zinc-400 truncate" title={item}>
                    {item}
                  </div>
                ))
              ) : (
                <div className="py-2 text-zinc-500 text-center italic">{l.empty}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
