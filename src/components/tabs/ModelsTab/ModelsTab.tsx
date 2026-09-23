import { Section } from '@/components/design-system/molecules/Section/Section';
import { ModelBreakdown } from '@/components/design-system/organisms/ModelBreakdown/ModelBreakdown';
import { EffortBreakdown } from '@/components/design-system/organisms/EffortBreakdown/EffortBreakdown';
import { effortHelp } from '@/components/design-system/organisms/EffortBreakdown/utils';
import { CostCalculation } from '@/components/design-system/organisms/CostCalculation/CostCalculation';
import { DonutSkeleton, BarsSkeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
import { usePolling } from '@/hooks/usePolling';
import { useSource } from '@/hooks/useSource';
import { useLiveData } from '@/hooks/useLiveData';
import { useAiInsightCtx } from '@/hooks/useAiInsightContext';
import { titleScope } from '@/lib/platform';
import type { EffortData } from '@/types';

/**
 * Model statistics only: the effective-token share per model and the reasoning
 * effort each model ran at, then the rate card. The same two cards on every
 * platform (both already scoped by `withSrc`); tool-call counts are not a model
 * statistic and live on Insights.
 */
export function ModelsTab() {
  const { platform, withSrc } = useSource();
  const { models } = useLiveData();
  const { aiProps } = useAiInsightCtx();
  const effort = usePolling<EffortData>(withSrc('/api/usage/effort?days=7'), 30000);

  // Under Claude the suffix is empty, so the titles read exactly as before.
  const scope = titleScope(platform);

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section
          title={`Model breakdown${scope} · 7d`}
          help={
            platform === 'claude'
              ? "Share of effective tokens by model over the last 7 days, with each model's cost per 1M effective tokens. Shows which models your usage leans on."
              : `Share of effective tokens by model over the last 7 days, with each model's cost per 1M effective tokens. Covers ${
                  platform === 'codex' ? 'the Codex (GPT) models' : 'both the Claude and the Codex (GPT) models'
                }; Codex costs are OpenAI list-price estimates and the internal guardian review model is unpriced.`
          }
          {...aiProps('models', models.data)}
        >
          {models.data ? (
            <ModelBreakdown models={models.data.models} />
          ) : models.loading ? (
            <DonutSkeleton />
          ) : null}
        </Section>
        <Section title={`Reasoning effort${scope} · 7d`} help={effortHelp(platform)}>
          {effort.data ? (
            <EffortBreakdown data={effort.data} />
          ) : effort.loading ? (
            <BarsSkeleton />
          ) : null}
        </Section>
      </div>
      <CostCalculation platform={platform} />
    </>
  );
}
