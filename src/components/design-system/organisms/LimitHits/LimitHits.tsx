import { Section } from '@/components/design-system/molecules/Section/Section';
import { LegendDot } from '@/components/design-system/atoms/LegendDot/LegendDot';
import { BarsSkeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
import { usePolling } from '@/hooks/usePolling';
import { useSource } from '@/hooks/useSource';
import { dateTimeLabel, shortModel } from '@/lib/format';
import { titleScope } from '@/lib/platform';
import type { LimitHitsData } from '@/types';
import type { LimitFigureProps, LimitHitRowProps, LimitHitsProps } from './types';
import { LIMIT_HITS_HELP, PLATFORM_COLOR, PLATFORM_OF, kindLabel, resetLabel } from './utils';

function Figure({ label, value, sub, accent }: LimitFigureProps) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      <div className="text-xs text-zinc-500">{sub}</div>
    </div>
  );
}

function EpisodeRow({ episode: e, showPlatform, now }: LimitHitRowProps) {
  const reset = resetLabel(e, now);
  const platform = PLATFORM_OF[e.source];
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <div className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 tabular-nums text-zinc-400">{dateTimeLabel(e.start)}</span>
        <span className="shrink-0 font-semibold text-zinc-200">{kindLabel(e)}</span>
        {e.kind !== 'model' && e.model && <span className="truncate text-zinc-500">{shortModel(e.model)}</span>}
        {showPlatform && <LegendDot color={PLATFORM_COLOR[platform]} label={platform} />}
      </div>
      <span className={`shrink-0 tabular-nums ${reset.active ? 'font-semibold text-red-400' : 'text-zinc-500'}`}>
        {reset.text}
        {e.requests > 1 && <span className="text-zinc-600"> ({e.requests})</span>}
      </span>
    </div>
  );
}

/**
 * When a usage limit refused requests: episodes in the last 7 / 30 days, whether one
 * is blocking right now, and the most recent ones — the same card on every platform
 * (Claude from `rate_limit` refusals, Codex from `usage_limit_exceeded` turns).
 */
export function LimitHits({ maxRows = 6 }: LimitHitsProps) {
  const { withSrc, platform } = useSource();
  const { data, loading } = usePolling<LimitHitsData>(withSrc('/api/insights/limits?days=30'), 60000);
  const now = Date.now();

  return (
    <Section title={`Limit hits${titleScope(platform)}`} help={LIMIT_HITS_HELP}>
      {!data ? (
        loading ? <BarsSkeleton rows={3} /> : null
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Figure label="Last 7 days" value={String(data.episodes7d)} sub={`${data.requests7d} refused requests`} />
            <Figure label="Last 30 days" value={String(data.episodes30d)} sub={`${data.requests30d} refused requests`} />
            <Figure
              label="Right now"
              value={data.active ? 'Blocked' : 'Clear'}
              sub={data.active ? `${kindLabel(data.active)} · ${resetLabel(data.active, now).text}` : 'no limit is blocking'}
              accent={data.active ? '#ef4444' : undefined}
            />
          </div>
          {data.episodes.length > 0 ? (
            <div className="mt-4 space-y-2 border-t border-white/5 pt-4">
              {data.episodes.slice(0, maxRows).map((e) => (
                <EpisodeRow key={`${e.source}|${e.kind}|${e.start}`} episode={e} showPlatform={platform === 'both'} now={now} />
              ))}
            </div>
          ) : (
            <p className="mt-4 border-t border-white/5 pt-4 text-xs text-zinc-500">No limit hits in the last 30 days.</p>
          )}
        </>
      )}
    </Section>
  );
}
