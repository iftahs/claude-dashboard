import { useState } from 'react';
import { StatCard } from '@/components/design-system/atoms/StatCard/StatCard';
import { ToggleGroup } from '@/components/design-system/atoms/ToggleGroup/ToggleGroup';
import { BarsSkeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
import { Section } from '@/components/design-system/molecules/Section/Section';
import { ErrorBreakdown } from '@/components/design-system/organisms/ErrorBreakdown/ErrorBreakdown';
import { LanguageBreakdown } from '@/components/design-system/organisms/LanguageBreakdown/LanguageBreakdown';
import { BranchBreakdown } from '@/components/design-system/organisms/BranchBreakdown/BranchBreakdown';
import { McpBreakdown } from '@/components/design-system/organisms/McpBreakdown/McpBreakdown';
import { ComplexityScatter } from '@/components/design-system/organisms/ComplexityScatter/ComplexityScatter';
import { YieldPanel } from '@/components/design-system/organisms/YieldPanel/YieldPanel';
import { RetryPanel } from '@/components/design-system/organisms/RetryPanel/RetryPanel';
import { RejectionsPanel } from '@/components/design-system/organisms/RejectionsPanel/RejectionsPanel';
import { SubagentStatsPanel } from '@/components/design-system/organisms/SubagentStatsPanel/SubagentStatsPanel';
import { CommandUsage } from '@/components/design-system/organisms/CommandUsage/CommandUsage';
import { FileChurn } from '@/components/design-system/organisms/FileChurn/FileChurn';
import { ToolUsage } from '@/components/design-system/organisms/ToolUsage/ToolUsage';
import { TurnLatency } from '@/components/design-system/organisms/TurnLatency/TurnLatency';
import { toolLabel } from '@/lib/format';
import { track } from '@/lib/analytics';
import { titleScope } from '@/lib/platform';
import { usePolling } from '@/hooks/usePolling';
import { useSource } from '@/hooks/useSource';
import { useAiInsightCtx } from '@/hooks/useAiInsightContext';
import { INSIGHT_DAY_OPTIONS, kpiCards, panelCopy, type InsightDays } from './utils';
import type {
  InsightsErrors,
  InsightsRetries,
  InsightsLanguages,
  InsightsBranches,
  InsightsMcp,
  ComplexityPoint,
  InsightsYield,
  InsightsRejections,
  SubagentStats,
  CommandUsageData,
  FileChurnData,
  InsightsSummary,
  InsightsTurns,
  ToolsData,
} from '@/types';

const TWO_COL = 'grid grid-cols-1 gap-6 lg:grid-cols-2';
const POLL = 60_000;

/**
 * One grid for every platform. Claude, Codex and Both render the same panels in the
 * same rows; where a platform has no signal the panel says so (n/a / empty state)
 * instead of disappearing, and the copy names the platform's own concepts (guardian
 * reviews, patches) rather than Claude's.
 */
export function InsightsTab() {
  const { platform, withSrc } = useSource();
  const { aiProps } = useAiInsightCtx();
  const [insightDays, setInsightDays] = useState<InsightDays>('7');
  const scope = titleScope(platform);
  const copy = panelCopy(platform);
  const q = (path: string) => withSrc(`${path}?days=${insightDays}`);

  const summary = usePolling<InsightsSummary>(q('/api/insights/summary'), POLL);
  const insightErrors = usePolling<InsightsErrors>(q('/api/insights/errors'), POLL);
  const tools = usePolling<ToolsData>(q('/api/insights/tools'), POLL);
  const insightMcp = usePolling<InsightsMcp>(q('/api/insights/mcp'), POLL);
  const insightRejections = usePolling<InsightsRejections>(q('/api/insights/rejections'), POLL);
  const insightRetries = usePolling<InsightsRetries>(q('/api/insights/retries'), POLL);
  const insightLanguages = usePolling<InsightsLanguages[]>(q('/api/insights/languages'), POLL);
  const insightBranches = usePolling<InsightsBranches[]>(q('/api/insights/branches'), POLL);
  const insightComplexity = usePolling<ComplexityPoint[]>(q('/api/insights/complexity'), POLL);
  const insightTurns = usePolling<InsightsTurns>(q('/api/insights/turns'), POLL);
  const insightYield = usePolling<InsightsYield>(q('/api/insights/yield'), POLL);
  const insightSubagents = usePolling<SubagentStats>(q('/api/insights/subagents'), POLL);
  const insightCommands = usePolling<CommandUsageData>(q('/api/insights/commands'), POLL);
  const insightChurn = usePolling<FileChurnData>(q('/api/insights/churn'), POLL);

  return (
    <>
      {/* Header row: day selector */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-zinc-500">Behavior analytics for the selected window{scope}</div>
        <ToggleGroup<InsightDays>
          options={INSIGHT_DAY_OPTIONS}
          value={insightDays}
          onChange={(d) => {
            setInsightDays(d);
            track('insight_range_changed', { days: d });
          }}
        />
      </div>

      {/* KPI row — figures no panel below repeats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {kpiCards(summary.data, platform).map((k) => (
          <StatCard key={k.key} label={k.label} value={k.value} sub={k.sub} accent={k.accent} help={k.help} />
        ))}
      </div>

      {/* Tool errors — full width */}
      <Section title={copy.errors.title} help={copy.errors.help} {...aiProps('errors', insightErrors.data)}>
        <ErrorBreakdown data={insightErrors.data} />
      </Section>

      {/* Tools: usage by tool | MCP vs built-in */}
      <div className={TWO_COL}>
        <Section title={copy.tools.title} help={copy.tools.help} {...aiProps('tools', tools.data)}>
          {tools.data ? (
            <ToolUsage
              tools={tools.data.tools.map((t) => ({ ...t, name: toolLabel(t.name) }))}
              totalCalls={tools.data.totalCalls}
              days={Number(insightDays)}
              limit={14}
            />
          ) : (
            <BarsSkeleton />
          )}
        </Section>
        <Section title={copy.mcp.title} help={copy.mcp.help} {...aiProps('mcp', insightMcp.data)}>
          <McpBreakdown data={insightMcp.data} platform={platform} />
        </Section>
      </div>

      {/* Friction: rejections | edit retries */}
      <div className={TWO_COL}>
        <Section title={copy.rejections.title} help={copy.rejections.help} {...aiProps('rejections', insightRejections.data)}>
          <RejectionsPanel data={insightRejections.data} platform={platform} />
        </Section>
        <Section
          title={copy.retries.title}
          help={copy.retries.help}
          {...(copy.retries.naText ? {} : aiProps('retries', insightRetries.data))}
        >
          <RetryPanel data={insightRetries.data} naText={copy.retries.naText} note={copy.retries.note} />
        </Section>
      </div>

      {/* Where the work went: languages | branches */}
      <div className={TWO_COL}>
        <Section title={copy.languages.title} help={copy.languages.help} {...aiProps('languages', insightLanguages.data)}>
          <LanguageBreakdown data={insightLanguages.data} />
        </Section>
        <Section title={copy.branches.title} help={copy.branches.help} {...aiProps('branches', insightBranches.data)}>
          <BranchBreakdown data={insightBranches.data} emptyText={copy.branches.emptyText} />
        </Section>
      </div>

      {/* Complexity scatter — full width */}
      <Section title={copy.complexity.title} help={copy.complexity.help} {...aiProps('complexity', insightComplexity.data)}>
        <ComplexityScatter data={insightComplexity.data} platform={platform} />
      </Section>

      {/* Turn latency — full width */}
      <Section title={copy.turns.title} help={copy.turns.help} {...aiProps('turns', insightTurns.data)}>
        <TurnLatency data={insightTurns.data} platform={platform} />
      </Section>

      {/* Yield | Subagents */}
      <div className={TWO_COL}>
        <Section title={copy.yield.title} help={copy.yield.help} {...aiProps('yield', insightYield.data)}>
          <YieldPanel data={insightYield.data} />
        </Section>
        <Section title={copy.subagents.title} help={copy.subagents.help} {...aiProps('subagents', insightSubagents.data)}>
          <SubagentStatsPanel data={insightSubagents.data} platform={platform} />
        </Section>
      </div>

      {/* Commands | File churn */}
      <div className={TWO_COL}>
        <Section title={copy.commands.title} help={copy.commands.help} {...aiProps('commands', insightCommands.data)}>
          <CommandUsage data={insightCommands.data} emptyText={copy.commands.emptyText} />
        </Section>
        <Section title={copy.churn.title} help={copy.churn.help} {...aiProps('churn', insightChurn.data)}>
          <FileChurn data={insightChurn.data} />
        </Section>
      </div>
    </>
  );
}
