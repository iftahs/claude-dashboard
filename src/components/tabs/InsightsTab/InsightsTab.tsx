import { useState } from 'react';
import { StatCard } from '@/components/design-system/atoms/StatCard/StatCard';
import { ToggleGroup } from '@/components/design-system/atoms/ToggleGroup/ToggleGroup';
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
import { compact, usd } from '@/lib/format';
import { track } from '@/lib/analytics';
import { usePolling } from '@/hooks/usePolling';
import { useSource } from '@/hooks/useSource';
import { useAiInsightCtx } from '@/hooks/useAiInsightContext';
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
} from '@/types';

type InsightDays = '7' | '14' | '30';
const INSIGHT_DAY_OPTIONS: { value: InsightDays; label: string }[] = [
  { value: '7', label: '7d' },
  { value: '14', label: '14d' },
  { value: '30', label: '30d' },
];

export function InsightsTab() {
  const { withSrc } = useSource();
  const { aiProps } = useAiInsightCtx();
  const [insightDays, setInsightDays] = useState<InsightDays>('7');
  const insightDaysNum = insightDays;

  const insightErrors = usePolling<InsightsErrors>(withSrc(`/api/insights/errors?days=${insightDaysNum}`), 60000);
  const insightRetries = usePolling<InsightsRetries>(withSrc(`/api/insights/retries?days=${insightDaysNum}`), 60000);
  const insightLanguages = usePolling<InsightsLanguages[]>(withSrc(`/api/insights/languages?days=${insightDaysNum}`), 60000);
  const insightBranches = usePolling<InsightsBranches[]>(withSrc(`/api/insights/branches?days=${insightDaysNum}`), 60000);
  const insightMcp = usePolling<InsightsMcp>(withSrc(`/api/insights/mcp?days=${insightDaysNum}`), 60000);
  const insightComplexity = usePolling<ComplexityPoint[]>(withSrc(`/api/insights/complexity?days=${insightDaysNum}`), 60000);
  const insightYield = usePolling<InsightsYield>(withSrc(`/api/insights/yield?days=${insightDaysNum}`), 60000);
  const insightRejections = usePolling<InsightsRejections>(withSrc(`/api/insights/rejections?days=${insightDaysNum}`), 60000);
  const insightSubagents = usePolling<SubagentStats>(withSrc(`/api/insights/subagents?days=${insightDaysNum}`), 60000);
  const insightCommands = usePolling<CommandUsageData>(`/api/insights/commands?days=${insightDaysNum}`, 60000);
  const insightChurn = usePolling<FileChurnData>(withSrc(`/api/insights/churn?days=${insightDaysNum}`), 60000);

  return (
    <>
      {/* Header row: day selector */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-zinc-500">Behavior analytics for the selected window</div>
        <ToggleGroup<InsightDays>
          options={INSIGHT_DAY_OPTIONS}
          value={insightDays}
          onChange={(d) => {
            setInsightDays(d);
            track('insight_range_changed', { days: d });
          }}
        />
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Error rate"
          value={insightErrors.data ? `${(insightErrors.data.errorRate * 100).toFixed(1)}%` : '—'}
          sub={
            insightErrors.data
              ? `${insightErrors.data.errors} errors / ${insightErrors.data.totalCalls} calls`
              : 'loading…'
          }
          accent="#f87171"
          help="Share of tool calls in this window that failed or were rejected (error result returned). Lower is better."
        />
        <StatCard
          label="One-shot rate"
          value={insightRetries.data ? `${(insightRetries.data.oneShotRate * 100).toFixed(1)}%` : '—'}
          sub={insightRetries.data ? `${insightRetries.data.retried} retried edits` : 'loading…'}
          help="Share of Edit/Write calls that succeeded on the first try (no follow-up retry on the same file). Higher means cleaner edits."
        />
        <StatCard
          label="Delegation rate"
          value={insightSubagents.data ? `${(insightSubagents.data.delegationRate * 100).toFixed(0)}%` : '—'}
          sub={insightSubagents.data ? `${insightSubagents.data.spawns} subagent spawns` : 'loading…'}
          help="Share of sessions that spawned at least one subagent (Task/Agent tool). Indicates how often work is delegated to subagents."
        />
        <StatCard
          label="Wasted tokens"
          value={insightRetries.data ? compact(insightRetries.data.wastedTokens) : '—'}
          sub={insightRetries.data ? `est. ${usd(insightRetries.data.wastedCost)} wasted` : 'loading…'}
          accent="#f59e0b"
          help="Estimated tokens spent on edits that errored and had to be retried — approximated from each session's average tokens-per-turn. A rough waste indicator."
        />
      </div>

      {/* Tool errors — full width */}
      <Section
        title="Tool errors · failure analysis"
        help="Failed/rejected tool calls in this window, grouped by error category (left) and by tool (right). The line shows errors per day. Percentages are each tool's own error rate."
        {...aiProps('errors', insightErrors.data)}
      >
        <ErrorBreakdown data={insightErrors.data} />
      </Section>

      {/* Languages | Branches */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section
          title="Languages · edits by file type"
          help="Files touched in this window, bucketed by extension into a language. Solid = edits/writes; dimmed = reads. Shows what kinds of files the work concentrated on."
          {...aiProps('languages', insightLanguages.data)}
        >
          <LanguageBreakdown data={insightLanguages.data} />
        </Section>
        <Section
          title="Branches · token usage by git branch"
          help="Effective tokens, cost and session count attributed to each git branch (shown as repo / branch). Reflects which branches the most work went into."
          {...aiProps('branches', insightBranches.data)}
        >
          <BranchBreakdown data={insightBranches.data} />
        </Section>
      </div>

      {/* MCP | Rejections */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section
          title="MCP vs built-in · tool call split"
          help="How tool calls split between Claude's built-in tools and tools from connected MCP servers. The per-server table lists call counts and how many failed (errors), one row per MCP server."
          {...aiProps('mcp', insightMcp.data)}
        >
          <McpBreakdown data={insightMcp.data} />
        </Section>
        <Section
          title="Permission rejections · by tool"
          help="Tool calls you declined when Claude asked for permission, grouped by tool. High counts flag tools Claude reaches for that you often block."
          {...aiProps('rejections', insightRejections.data)}
        >
          <RejectionsPanel data={insightRejections.data} />
        </Section>
      </div>

      {/* Complexity scatter — full width */}
      <Section
        title="Session complexity · tool calls vs tokens (dot size = subagents)"
        help="One dot per session: x = number of tool calls, y = effective tokens, dot size = subagents spawned. Dots to the upper-right are the heaviest, most complex sessions."
        {...aiProps('complexity', insightComplexity.data)}
      >
        <ComplexityScatter data={insightComplexity.data} />
      </Section>

      {/* Yield | Subagent stats */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section
          title="Yield · committed vs uncommitted sessions"
          help="Sessions that ran a git commit vs those that didn't — a rough proxy for which work landed. Lists the biggest uncommitted sessions by tokens."
          {...aiProps('yield', insightYield.data)}
        >
          <YieldPanel data={insightYield.data} />
        </Section>
        <Section
          title="Subagent stats · delegation analysis"
          help="Subagent (Task/Agent) spawns in this window: total, average per delegating session, and breakdowns by subagent type and model."
          {...aiProps('subagents', insightSubagents.data)}
        >
          <SubagentStatsPanel data={insightSubagents.data} />
        </Section>
      </div>

      {/* Retry panel — standalone */}
      <Section
        title="Edit retries · one-shot analysis"
        help="Edit/Write calls that succeeded first try vs those retried after an error, with the estimated tokens and cost wasted on the retries."
        {...aiProps('retries', insightRetries.data)}
      >
        <RetryPanel data={insightRetries.data} />
      </Section>

      {/* Commands | File churn */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Section
          title="Commands · slash-command & skill usage"
          help="How often each slash command / skill was invoked in this window, from your local command history. Reflects which commands you reach for most."
          {...aiProps('commands', insightCommands.data)}
        >
          <CommandUsage data={insightCommands.data} />
        </Section>
        <Section
          title="File churn · most-edited files"
          help="Files edited most often (Edit/Write/MultiEdit calls) in this window. Hover a row for the full path. High churn flags the files the work concentrated on."
          {...aiProps('churn', insightChurn.data)}
        >
          <FileChurn data={insightChurn.data} />
        </Section>
      </div>
    </>
  );
}
