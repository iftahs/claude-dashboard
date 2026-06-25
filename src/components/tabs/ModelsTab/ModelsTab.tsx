import { Section } from '@/components/design-system/molecules/Section/Section';
import { ModelBreakdown } from '@/components/design-system/organisms/ModelBreakdown/ModelBreakdown';
import { ToolUsage } from '@/components/design-system/organisms/ToolUsage/ToolUsage';
import { CostCalculation } from '@/components/design-system/organisms/CostCalculation/CostCalculation';
import { DonutSkeleton, BarsSkeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
import { usePolling } from '@/hooks/usePolling';
import { useSource } from '@/hooks/useSource';
import { useLiveData } from '@/hooks/useLiveData';
import { useAiInsightCtx } from '@/hooks/useAiInsightContext';
import type { ToolsData } from '@/types';

export function ModelsTab() {
  const { withSrc } = useSource();
  const { models } = useLiveData();
  const { aiProps } = useAiInsightCtx();
  const tools = usePolling<ToolsData>(withSrc('/api/tools?days=7'), 30000);

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section
          title="Model breakdown · 7d"
          help="Share of effective tokens by model over the last 7 days, with each model's cost per 1M effective tokens. Shows which models your usage leans on."
          {...aiProps('models', models.data)}
        >
          {models.data ? (
            <ModelBreakdown models={models.data.models} />
          ) : models.loading ? (
            <DonutSkeleton />
          ) : null}
        </Section>
        <Section
          title="Tool usage · 7d"
          help="How many times each tool was invoked over the last 7 days, ranked. Reflects which tools the work relied on most."
          {...aiProps('tools', tools.data)}
        >
          {tools.data ? (
            <ToolUsage tools={tools.data.tools} totalCalls={tools.data.totalCalls} />
          ) : tools.loading ? (
            <BarsSkeleton />
          ) : null}
        </Section>
      </div>
      <CostCalculation />
    </>
  );
}
