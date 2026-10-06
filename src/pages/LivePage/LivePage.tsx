import { GroupLabel } from '@/components/design-system/atoms/GroupLabel/GroupLabel';
import { PageHeader } from '@/components/design-system/atoms/PageHeader/PageHeader';
import { SegmentedControl } from '@/components/design-system/atoms/SegmentedControl/SegmentedControl';
import { ExtraUsageCard } from '@/components/design-system/organisms/ExtraUsageCard/ExtraUsageCard';
import { HourlyUsageChart } from '@/components/design-system/organisms/HourlyUsageChart/HourlyUsageChart';
import { LimitContributors } from '@/components/design-system/organisms/LimitContributors/LimitContributors';
import { LimitGauge } from '@/components/design-system/organisms/LimitGauge/LimitGauge';
import { LimitHitsCard } from '@/components/design-system/organisms/LimitHitsCard/LimitHitsCard';
import { PlanLimitsCard } from '@/components/design-system/organisms/PlanLimitsCard/PlanLimitsCard';
import { SpendCapsCard } from '@/components/design-system/organisms/SpendCapsCard/SpendCapsCard';
import { PageLayout } from '@/components/design-system/templates/PageLayout/PageLayout';
import { SectionStackLayout } from '@/components/design-system/templates/SectionStackLayout/SectionStackLayout';
import { SplitLayout } from '@/components/design-system/templates/SplitLayout/SplitLayout';
import { useLivePage } from '@/hooks/useLivePage';

const DESCRIPTION = 'Your current window, plan limits and what is driving them.';
const HOURS_LABEL = 'Hours in the hourly chart';

export function LivePage() {
  const view = useLivePage();
  const { both, plans, extras, spendCaps } = view;

  const gauges = view.gauges.map((gauge) => <LimitGauge key={gauge.platform} view={gauge} />);
  const chart = <HourlyUsageChart view={view.hourly} />;
  const contributors = view.contributors.map((card) => (
    <LimitContributors key={card.key} view={card} onRangeChange={view.onContribRange} />
  ));
  const limitHits = <LimitHitsCard view={view.limitHits} />;

  return (
    <PageLayout
      header={
        <PageHeader
          description={DESCRIPTION}
          actions={
            <SegmentedControl
              ariaLabel={HOURS_LABEL}
              size="sm"
              options={view.hourOptions}
              value={view.hours}
              onChange={view.onHoursChange}
            />
          }
        />
      }
    >
      <SectionStackLayout title={<GroupLabel>Current window</GroupLabel>}>
        {gauges.length > 1 ? <SplitLayout>{gauges}</SplitLayout> : null}
        {gauges.length === 1 ? (
          <SplitLayout ratio="1:2">
            {gauges}
            {chart}
          </SplitLayout>
        ) : (
          chart
        )}
      </SectionStackLayout>

      {plans.length > 0 || extras.length > 0 ? (
        <SectionStackLayout title={<GroupLabel>Plan limits</GroupLabel>}>
          {plans.length > 1 ? (
            <SplitLayout>
              {plans.map((plan) => (
                <PlanLimitsCard key={plan.key} view={plan} />
              ))}
            </SplitLayout>
          ) : null}
          {plans.length === 1 && extras.length === 1 ? (
            <SplitLayout ratio="2:1">
              <PlanLimitsCard view={plans[0]} columns={2} />
              <ExtraUsageCard view={extras[0]} />
            </SplitLayout>
          ) : null}
          {plans.length === 1 && extras.length !== 1 ? <PlanLimitsCard view={plans[0]} columns={2} /> : null}
          {extras.length > 1 ? (
            <SplitLayout>
              {extras.map((extra) => (
                <ExtraUsageCard key={extra.platform} view={extra} />
              ))}
            </SplitLayout>
          ) : null}
          {plans.length !== 1 && extras.length === 1 ? <ExtraUsageCard view={extras[0]} /> : null}
        </SectionStackLayout>
      ) : null}

      <SectionStackLayout title={<GroupLabel>Drivers</GroupLabel>}>
        {both && contributors.length > 1 ? <SplitLayout>{contributors}</SplitLayout> : null}
        {both && contributors.length === 1 ? contributors : null}
        {both || contributors.length === 0 ? (
          limitHits
        ) : (
          <SplitLayout>
            {contributors}
            {limitHits}
          </SplitLayout>
        )}
      </SectionStackLayout>

      {spendCaps ? (
        <SectionStackLayout title={<GroupLabel>Spend against your caps</GroupLabel>}>
          <SpendCapsCard view={spendCaps} />
        </SectionStackLayout>
      ) : null}
    </PageLayout>
  );
}
