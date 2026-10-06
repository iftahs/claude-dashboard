import { useCallback, useMemo, useState } from 'react';
import { ExtraUsageCard } from '@/components/design-system/organisms/ExtraUsageCard/ExtraUsageCard';
import { HourlyUsageChart } from '@/components/design-system/organisms/HourlyUsageChart/HourlyUsageChart';
import { LimitContributors } from '@/components/design-system/organisms/LimitContributors/LimitContributors';
import { LimitGauge } from '@/components/design-system/organisms/LimitGauge/LimitGauge';
import { LimitHitsCard } from '@/components/design-system/organisms/LimitHitsCard/LimitHitsCard';
import { PlanLimitsCard } from '@/components/design-system/organisms/PlanLimitsCard/PlanLimitsCard';
import { Section } from '@/components/design-system/organisms/Section/Section';
import { SpendCapsCard } from '@/components/design-system/organisms/SpendCapsCard/SpendCapsCard';
import { UsageBarChart } from '@/components/design-system/organisms/UsageBarChart/UsageBarChart';
import { SplitLayout } from '@/components/design-system/templates/SplitLayout/SplitLayout';
import { dayLabel } from '@/lib/format';
import type { ContribRange } from '@/lib/views/live';
import { Specimen } from '../../Specimen/Specimen';
import {
  CAP_VIEWS,
  CONTRIBUTOR_STATE_VIEWS,
  DAILY_BUCKETS,
  DAILY_COST_PER_DAY,
  DAILY_TOKENS_PER_DAY,
  EXTRA_OFF_VIEWS,
  EXTRA_VIEWS,
  GAUGE_VIEWS,
  GAUGE_WIDE_VIEW,
  HIT_VIEWS,
  HOURLY_STATE_VIEWS,
  HOURLY_VIEW,
  PLAN_VIEWS,
  PLAN_WIDE_VIEW,
  contributorsView,
} from './utils';

function ignoreRange(): void {}

export function LiveSpecimens() {
  const [range, setRange] = useState<ContribRange>('day');
  const onRangeChange = useCallback((_key: string, next: ContribRange) => setRange(next), []);
  const contributors = useMemo(() => contributorsView(range), [range]);

  return (
    <>
      <Specimen
        name="LimitGauge"
        note="Every reading state, then the full-width layout used below 1280px"
        layout="stack"
      >
        <SplitLayout columns={3}>
          {GAUGE_VIEWS.map((view, index) => (
            <LimitGauge key={index} view={view} />
          ))}
        </SplitLayout>
        <LimitGauge view={GAUGE_WIDE_VIEW} wideBelowXl />
      </Specimen>
      <Specimen name="HourlyUsageChart" note="Four models over 24 hours, then loading, empty and failed" layout="stack">
        <HourlyUsageChart view={HOURLY_VIEW} />
        <SplitLayout columns={3}>
          {HOURLY_STATE_VIEWS.map((view, index) => (
            <HourlyUsageChart key={index} view={view} />
          ))}
        </SplitLayout>
      </Specimen>
      <Specimen name="UsageBarChart" note="Daily est. cost and effective tokens with projected days and the today marker" layout="stack">
        <SplitLayout>
          <Section title="Est. cost per day" description="Last 7 days, by model, with a projection" as="h3">
            <UsageBarChart
              buckets={DAILY_BUCKETS}
              labelFor={dayLabel}
              metric="cost"
              projectionCostPerDay={DAILY_COST_PER_DAY}
              ariaLabel="Est. cost per day, last 7 days, by model, with three projected days"
            />
          </Section>
          <Section title="Effective tokens per day" description="Last 7 days, by model" as="h3">
            <UsageBarChart
              buckets={DAILY_BUCKETS}
              labelFor={dayLabel}
              projectionCostPerDay={DAILY_COST_PER_DAY}
              projectionTokensPerDay={DAILY_TOKENS_PER_DAY}
              height={200}
              ariaLabel="Effective tokens per day, last 7 days, by model, with three projected days"
            />
          </Section>
        </SplitLayout>
      </Specimen>
      <Specimen
        name="PlanLimitsCard"
        note="One plan across the page, then accounts, Codex, offline, expired and loading"
        layout="stack"
      >
        <PlanLimitsCard view={PLAN_WIDE_VIEW} columns={2} />
        <SplitLayout>
          {PLAN_VIEWS.map((view, index) => (
            <PlanLimitsCard key={index} view={view} />
          ))}
        </SplitLayout>
      </Specimen>
      <Specimen name="ExtraUsageCard" note="A monthly limit, credit balances, then switched off" layout="stack">
        <SplitLayout>
          {EXTRA_VIEWS.map((view, index) => (
            <ExtraUsageCard key={index} view={view} />
          ))}
        </SplitLayout>
        <SplitLayout>
          {EXTRA_OFF_VIEWS.map((view, index) => (
            <ExtraUsageCard key={index} view={view} />
          ))}
        </SplitLayout>
      </Specimen>
      <Specimen name="LimitContributors" note="Day has four groups, Week has nothing over 10%. Then empty, loading and failed." layout="stack">
        <SplitLayout>
          <LimitContributors view={contributors} onRangeChange={onRangeChange} />
          {CONTRIBUTOR_STATE_VIEWS.map((view) => (
            <LimitContributors key={view.key} view={view} onRangeChange={ignoreRange} />
          ))}
        </SplitLayout>
      </Specimen>
      <Specimen name="LimitHitsCard" note="A limit blocking right now with mixed episodes, no hits, loading and failed" layout="stack">
        <SplitLayout>
          {HIT_VIEWS.map((view, index) => (
            <LimitHitsCard key={index} view={view} />
          ))}
        </SplitLayout>
      </Specimen>
      <Specimen name="SpendCapsCard" note="Capped periods across the tones, billed spend, a reached cap, loading and failed" layout="stack">
        {CAP_VIEWS.map((view, index) => (
          <SpendCapsCard key={index} view={view} />
        ))}
      </Specimen>
    </>
  );
}
