import { Section } from '@/components/design-system/molecules/Section/Section';
import { LegendDot } from '@/components/design-system/atoms/LegendDot/LegendDot';
import { InfoTip } from '@/components/design-system/atoms/InfoTip/InfoTip';
import { Skeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
import { CodexPlanPanel } from '@/components/design-system/organisms/CodexPlanPanel/CodexPlanPanel';
import { compact } from '@/lib/format';
import type { ComparisonRow, PlatformComparisonProps } from './types';
import { PLATFORM_COLOR, comparisonRows, platformTotals, shareSplit, topModel } from './utils';

const SHARE_HELP =
  'Split of effective tokens between the two platforms over the selected Trends window — Claude (Claude Code + Cowork) against Codex (the ChatGPT desktop app). Effective tokens are what count against each provider\u2019s rate limits.';

/** Column heading: a coloured dot, the platform name and what it covers. */
function PlatformHeading({ color, name, sub }: { color: string; name: string; sub: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="h-2 w-2 flex-none rounded-full" style={{ backgroundColor: color }} />
      <h3 className="text-sm font-semibold text-zinc-200">{name}</h3>
      <span className="truncate text-xs text-zinc-500">{sub}</span>
    </div>
  );
}

/** The per-platform figures for the selected window — identical rows on both sides. */
function MetricsCard({ rows, weekDays, loading }: { rows: ComparisonRow[]; weekDays: number; loading?: boolean }) {
  return (
    <div className="card p-5">
      <div className="mb-3 text-xs uppercase tracking-wider text-zinc-500">Last {weekDays} days</div>
      <dl className="space-y-2">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center justify-between gap-3 text-sm">
            <dt className="flex items-center gap-1.5 text-zinc-400">
              {r.label}
              {r.help && <InfoTip text={r.help} />}
            </dt>
            <dd className="font-semibold tabular-nums text-zinc-100">
              {loading ? <Skeleton className="h-4 w-16 rounded" /> : r.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * Claude and Codex side by side: each platform's live rate-limit card above the
 * same five figures for the selected Trends window, with a share bar underneath.
 * Only rendered under the "Both" platform switch, where the usage endpoints are
 * unscoped — so `bySource` carries all three surfaces and Claude is the sum of
 * its two (Claude Code + Cowork).
 */
export function PlatformComparison({
  claudePlan,
  codexLive,
  codexProfile,
  weekStart,
  bySource,
  byModel,
  weekDays,
  loading,
}: PlatformComparisonProps) {
  const totals = platformTotals(bySource);
  const share = shareSplit(totals.claude, totals.codex);
  const hasSplit = totals.claude.effectiveTokens + totals.codex.effectiveTokens > 0;

  return (
    <>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <PlatformHeading color={PLATFORM_COLOR.claude} name="Claude" sub="Claude Code + Cowork" />
          {claudePlan}
          <MetricsCard
            rows={comparisonRows(totals.claude, weekDays, topModel(byModel, false))}
            weekDays={weekDays}
            loading={loading && !bySource}
          />
        </div>
        <div className="space-y-4">
          <PlatformHeading color={PLATFORM_COLOR.codex} name="Codex" sub="ChatGPT desktop app" />
          <CodexPlanPanel live={codexLive} profile={codexProfile} weekStart={weekStart} compact />
          <MetricsCard
            rows={comparisonRows(totals.codex, weekDays, topModel(byModel, true))}
            weekDays={weekDays}
            loading={loading && !bySource}
          />
        </div>
      </div>

      <Section title={`Platform split · effective tokens · ${weekDays}d`} help={SHARE_HELP}>
        {hasSplit ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex h-3 flex-1 overflow-hidden rounded-full bg-ink-800 ring-1 ring-white/10">
              <div style={{ width: `${share.claude}%`, backgroundColor: PLATFORM_COLOR.claude }} />
              <div style={{ width: `${share.codex}%`, backgroundColor: PLATFORM_COLOR.codex }} />
            </div>
            <div className="flex items-center gap-4">
              <LegendDot
                color={PLATFORM_COLOR.claude}
                label={`Claude ${share.claude}% · ${compact(totals.claude.effectiveTokens)}`}
              />
              <LegendDot
                color={PLATFORM_COLOR.codex}
                label={`Codex ${share.codex}% · ${compact(totals.codex.effectiveTokens)}`}
              />
            </div>
          </div>
        ) : (
          <div className="text-sm text-zinc-600">No usage on either platform in this window</div>
        )}
      </Section>
    </>
  );
}
