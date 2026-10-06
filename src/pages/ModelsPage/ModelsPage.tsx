import { GroupLabel } from '@/components/design-system/atoms/GroupLabel/GroupLabel';
import { PageHeader } from '@/components/design-system/atoms/PageHeader/PageHeader';
import { CostCalculation } from '@/components/design-system/organisms/CostCalculation/CostCalculation';
import { EffortBreakdown } from '@/components/design-system/organisms/EffortBreakdown/EffortBreakdown';
import { ModelBreakdown } from '@/components/design-system/organisms/ModelBreakdown/ModelBreakdown';
import { PageLayout } from '@/components/design-system/templates/PageLayout/PageLayout';
import { SectionStackLayout } from '@/components/design-system/templates/SectionStackLayout/SectionStackLayout';
import { SplitLayout } from '@/components/design-system/templates/SplitLayout/SplitLayout';
import { useModelsPage } from '@/hooks/useModelsPage';

const MIX_LABEL = 'Mix';
const MIX_NOTE = 'Last 7 days';
const PRICING_LABEL = 'Pricing';
const PRICING_NOTE = 'List prices per 1M tokens';

export function ModelsPage() {
  const page = useModelsPage();

  return (
    <PageLayout header={<PageHeader description={page.description} />}>
      <SectionStackLayout title={<GroupLabel note={MIX_NOTE}>{MIX_LABEL}</GroupLabel>}>
        <SplitLayout collapseBelow="xl">
          <ModelBreakdown view={page.breakdown} />
          <EffortBreakdown view={page.effort} />
        </SplitLayout>
      </SectionStackLayout>
      <SectionStackLayout title={<GroupLabel note={PRICING_NOTE}>{PRICING_LABEL}</GroupLabel>}>
        <CostCalculation
          view={page.pricing}
          onSelectModel={page.onSelectModel}
          onToggleGroup={page.onTogglePriceGroup}
          onTokensChange={page.onTokensChange}
          onReset={page.onResetCalculator}
        />
      </SectionStackLayout>
    </PageLayout>
  );
}
