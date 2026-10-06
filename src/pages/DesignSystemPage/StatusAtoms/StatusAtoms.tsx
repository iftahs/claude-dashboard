import { ActivityBars } from '@/components/design-system/atoms/ActivityBars/ActivityBars';
import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import { Chip } from '@/components/design-system/atoms/Chip/Chip';
import { ElapsedTime } from '@/components/design-system/atoms/ElapsedTime/ElapsedTime';
import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { LegendDot } from '@/components/design-system/atoms/LegendDot/LegendDot';
import { ProgressBar } from '@/components/design-system/atoms/ProgressBar/ProgressBar';
import { Skeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
import { Sparkline } from '@/components/design-system/atoms/Sparkline/Sparkline';
import { StatusDot } from '@/components/design-system/atoms/StatusDot/StatusDot';
import { SweepBar } from '@/components/design-system/atoms/SweepBar/SweepBar';
import { SplitLayout } from '@/components/design-system/templates/SplitLayout/SplitLayout';
import { cn } from '@/lib/cn';
import { modelColor } from '@/lib/palette';
import { Specimen } from '../Specimen/Specimen';
import {
  BADGES,
  ICON_NAMES,
  INLINE_STATUS,
  METERS,
  MODELS,
  PAGE_LOADED_AT,
  PLATFORM_COLORS,
  ROW,
  SPARK_VALUES,
  STATUSES,
  SUNKEN_WELL,
  SWEEP_TONES,
} from '../utils';

export function StatusAtoms() {
  return (
    <>
      <SplitLayout>
        <Specimen name="Chip" note="A model keeps its colour everywhere">
          {MODELS.map((model) => (
            <Chip key={model.id} color={modelColor(model.id)}>
              {model.label}
            </Chip>
          ))}
          <Chip>inherit</Chip>
        </Specimen>
        <Specimen name="Badge" note="Soft fill, -fg text, never colour alone">
          {BADGES.map((badge) => (
            <Badge key={badge.label} tone={badge.tone}>
              {badge.icon ? <Icon name={badge.icon} size={12} /> : null}
              {badge.label}
            </Badge>
          ))}
        </Specimen>
      </SplitLayout>
      <SplitLayout>
        <Specimen name="StatusDot" note="Six tones, a live pulse and the small size" layout="stack">
          <div className="flex flex-wrap items-center gap-5">
            {STATUSES.map((status) => (
              <span key={status.label} className={INLINE_STATUS}>
                <StatusDot tone={status.tone} pulse={status.pulse} />
                {status.label}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-5">
            <span className={INLINE_STATUS}>
              <StatusDot size="sm" pulse />
              Live, small
            </span>
            <span className={INLINE_STATUS}>
              <StatusDot size="sm" tone="neutral" />
              Paused, small
            </span>
            <StatusDot tone="danger" label="Waiting on you" />
          </div>
        </Specimen>
        <Specimen name="LegendDot" note="Square for series, round for status" layout="stack">
          <div className="flex flex-wrap items-center gap-4">
            <LegendDot color={PLATFORM_COLORS.claude} value="~$33.10">
              Claude
            </LegendDot>
            <LegendDot color={PLATFORM_COLORS.codex} value="~$8.10">
              Codex
            </LegendDot>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {MODELS.map((model) => (
              <LegendDot key={model.id} color={modelColor(model.id)} shape="round">
                {model.label}
              </LegendDot>
            ))}
          </div>
        </Specimen>
      </SplitLayout>
      <SplitLayout>
        <Specimen name="SweepBar" note="Indeterminate 2px line in four tones, then pinned to the bottom edge of a well" layout="stack">
          <div className="flex max-w-xs flex-col gap-3">
            {SWEEP_TONES.map((tone) => (
              <SweepBar key={tone} tone={tone} label={`Running, ${tone}`} />
            ))}
          </div>
          <div className={cn(SUNKEN_WELL, 'max-w-xs text-small text-fg-muted')}>
            A running agent
            <SweepBar tone="success" className="absolute inset-x-1.5 bottom-0 w-auto bg-transparent" />
          </div>
        </Specimen>
        <Specimen name="ActivityBars" note="Three bars in the current text colour, beside the word that names the state" layout="stack">
          <div className="flex flex-wrap items-center gap-5">
            <span className={INLINE_STATUS}>
              <ActivityBars className="text-success" />
              Running
            </span>
            <span className={INLINE_STATUS}>
              <ActivityBars className="text-accent" />
              Working
            </span>
            <span className={INLINE_STATUS}>
              <ActivityBars className="text-info" />
              Syncing
            </span>
            <span className={INLINE_STATUS}>
              <ActivityBars />
              Inherited colour
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="success">
              <ActivityBars />
              Running
            </Badge>
            <Badge tone="success">
              <ActivityBars />
              Delegating
            </Badge>
          </div>
        </Specimen>
      </SplitLayout>
      <SplitLayout>
        <Specimen name="ProgressBar" note="40, 83 and 92 in accent, warning and danger" layout="stack">
          {METERS.map((meter) => (
            <ProgressBar key={meter.label} label={meter.label} value={meter.percent} tone={meter.tone} />
          ))}
          <ProgressBar label="Codex 5-hour limit" value={31} tone="codex" size="sm" />
          <ProgressBar label="Completed agents" value={89} tone="success" size="lg" />
          <ProgressBar label="Tool share" value={45} tone="neutral" size="sm" />
        </Specimen>
        <Specimen name="Sparkline" note="Last 7 days, today highlighted">
          <Sparkline values={SPARK_VALUES} highlightLast label="Est. spend, last 7 days" className="w-32" />
          <Sparkline values={SPARK_VALUES} height={24} className="w-24" />
        </Specimen>
      </SplitLayout>
      <SplitLayout>
        <Specimen name="ElapsedTime" note="Ticks once a second, tabular numerals" layout="stack">
          <div className={ROW}>
            <span className="text-small text-fg-muted">On this page for</span>
            <ElapsedTime since={PAGE_LOADED_AT} className="font-mono text-mono text-fg" />
          </div>
          <div className={ROW}>
            <span className="text-small text-fg-muted">Last event</span>
            <ElapsedTime since={PAGE_LOADED_AT - 25_000} format="ago" className="font-mono text-mono text-fg" />
            <span className="text-small text-fg-muted">Run started</span>
            <ElapsedTime since={PAGE_LOADED_AT - 4_632_000} className="font-mono text-mono text-fg" />
          </div>
        </Specimen>
        <Specimen name="Skeleton" note="Blocks in the shape of the content, shimmering on the card and on a sunken well" layout="stack">
          <div aria-busy="true" className="flex max-w-xs flex-col gap-3">
            <Skeleton width="40%" height={14} />
            <Skeleton height={8} />
            <Skeleton height={8} />
            <Skeleton width="72%" height={8} />
          </div>
          <div aria-busy="true" className={cn(SUNKEN_WELL, 'flex max-w-xs flex-col gap-3')}>
            <Skeleton width="40%" height={14} />
            <Skeleton height={8} />
            <Skeleton width="72%" height={8} />
          </div>
        </Specimen>
      </SplitLayout>
      <Specimen name="Icon" note="Lucide, 1.5px stroke, 12 to 20px" layout="stack">
        <div className="flex flex-wrap items-center gap-4 text-fg-muted">
          {ICON_NAMES.map((name) => (
            <Icon key={name} name={name} />
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-4 text-fg">
          <Icon name="activity" size={12} />
          <Icon name="activity" size={14} />
          <Icon name="activity" size={16} />
          <Icon name="activity" size={20} />
        </div>
      </Specimen>
    </>
  );
}
