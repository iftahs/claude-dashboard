import { Section } from '@/components/design-system/molecules/Section/Section';
import { ModelBreakdown } from '@/components/design-system/organisms/ModelBreakdown/ModelBreakdown';
import { ToolUsage } from '@/components/design-system/organisms/ToolUsage/ToolUsage';
import { CostCalculation } from '@/components/design-system/organisms/CostCalculation/CostCalculation';
import { DonutSkeleton, BarsSkeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
import { usePolling } from '@/hooks/usePolling';
import { useSource } from '@/hooks/useSource';
import { useLiveData } from '@/hooks/useLiveData';
import { useAiInsightCtx } from '@/hooks/useAiInsightContext';
import { titleScope } from '@/lib/platform';
import type { ToolsData } from '@/types';

export function ModelsTab() {
  const { platform, withSrc } = useSource();
  const { models } = useLiveData();
  const { aiProps } = useAiInsightCtx();
  const tools = usePolling<ToolsData>(withSrc('/api/tools?days=7'), 30000);

  // Both panels are already platform-scoped by `withSrc`; the titles just say so.
  // Under Claude the suffix is empty, so the tab is unchanged for Claude-only users.
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
        <Section
          title={`Tool usage${scope} · 7d`}
          help={
            platform === 'claude'
              ? 'How many times each tool was invoked over the last 7 days, ranked. Reflects which tools the work relied on most.'
              : `How many times each tool was invoked over the last 7 days, ranked. Codex tool calls (shell commands, file changes, MCP calls, web search) are mapped onto the same tool names as Claude's, so ${
                  platform === 'both' ? 'the two platforms rank in one list' : 'the ranking reads like the Claude one'
                }.`
          }
          {...aiProps('tools', tools.data)}
        >
          {tools.data ? (
            <ToolUsage tools={tools.data.tools} totalCalls={tools.data.totalCalls} />
          ) : tools.loading ? (
            <BarsSkeleton />
          ) : null}
        </Section>
      </div>
      <CostCalculation platform={platform} />
    </>
  );
}
