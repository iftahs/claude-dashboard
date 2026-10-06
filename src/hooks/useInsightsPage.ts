import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAiInsightCtx } from './useAiInsightContext';
import { usePolling } from './usePolling';
import type { PollState } from './usePolling';
import { useSource } from './useSource';
import { track } from '@/lib/analytics';
import type { Platform } from '@/lib/platform';
import type { SectionAi } from '@/lib/section';
import {
  DEFAULT_INSIGHT_VIEW,
  INSIGHT_DAY_OPTIONS,
  INSIGHT_VIEW_PARAM,
  INSIGHT_VIEW_TABS,
  buildBranches,
  buildCommandUsage,
  buildComplexity,
  buildErrorBreakdown,
  buildFileChurn,
  buildInsightKpis,
  buildLanguages,
  buildMcpBreakdown,
  buildRejections,
  buildRetries,
  buildSubagentStats,
  buildToolUsage,
  buildTurnLatency,
  buildYield,
  insightsDescription,
  parseInsightView,
  type BranchBreakdownView,
  type CommandUsageView,
  type ComplexityScatterView,
  type ErrorBreakdownView,
  type FileChurnView,
  type InsightDayOption,
  type InsightDays,
  type InsightKpisView,
  type InsightPoll,
  type InsightView,
  type InsightViewTab,
  type LanguageBreakdownView,
  type McpBreakdownView,
  type RejectionsPanelView,
  type RetryPanelView,
  type SubagentStatsPanelView,
  type ToolUsageView,
  type TurnLatencyView,
  type YieldPanelView,
} from '@/lib/views/insights';
import type {
  CommandUsageData,
  ComplexityPoint,
  FileChurnData,
  InsightsBranches,
  InsightsErrors,
  InsightsLanguages,
  InsightsMcp,
  InsightsRejections,
  InsightsRetries,
  InsightsSummary,
  InsightsTurns,
  InsightsYield,
  SubagentStats,
  ToolsData,
} from '@/types';

export interface InsightsPageView {
  view: InsightView;
  viewTabs: readonly InsightViewTab[];
  onViewChange: (view: InsightView) => void;
  days: InsightDays;
  dayOptions: readonly InsightDayOption[];
  onDaysChange: (days: InsightDays) => void;
  description: string;
  kpis: InsightKpisView;
  errors: ErrorBreakdownView;
  rejections: RejectionsPanelView;
  retries: RetryPanelView;
  tools: ToolUsageView;
  mcp: McpBreakdownView;
  commands: CommandUsageView;
  subagents: SubagentStatsPanelView;
  languages: LanguageBreakdownView;
  branches: BranchBreakdownView;
  yield: YieldPanelView;
  churn: FileChurnView;
  complexity: ComplexityScatterView;
  turns: TurnLatencyView;
}

interface SectionBuilderInput<T> {
  poll: InsightPoll<T>;
  platform: Platform;
  days: InsightDays;
  ai: SectionAi | null;
}

interface SectionScope {
  platform: Platform;
  days: InsightDays;
  sectionAi: (section: string, data: unknown) => SectionAi;
}

const POLL = 60_000;
const DEFAULT_DAYS: InsightDays = '7';

function useInsightSection<T, V>(
  poll: PollState<T>,
  aiSection: string,
  build: (input: SectionBuilderInput<T>) => V,
  { platform, days, sectionAi }: SectionScope,
): V {
  const { data, loading, error } = poll;
  const ai = useMemo(() => sectionAi(aiSection, data), [sectionAi, aiSection, data]);
  return useMemo(() => build({ poll: { data, loading, error }, platform, days, ai }), [build, data, loading, error, platform, days, ai]);
}

export function useInsightsPage(): InsightsPageView {
  const { platform, withSrc } = useSource();
  const { sectionAi } = useAiInsightCtx();
  const [params, setParams] = useSearchParams();
  const [insightDays, setInsightDays] = useState<InsightDays>(DEFAULT_DAYS);

  const view = parseInsightView(params.get(INSIGHT_VIEW_PARAM));
  const onReliability = view === 'reliability';
  const onTools = view === 'tools';
  const onCode = view === 'code';
  const onPace = view === 'pace';
  const q = (path: string) => withSrc(`${path}?days=${insightDays}`);

  const summary = usePolling<InsightsSummary>(q('/api/insights/summary'), POLL);
  const insightErrors = usePolling<InsightsErrors>(onReliability ? q('/api/insights/errors') : '', POLL);
  const insightRejections = usePolling<InsightsRejections>(onReliability ? q('/api/insights/rejections') : '', POLL);
  const insightRetries = usePolling<InsightsRetries>(onReliability ? q('/api/insights/retries') : '', POLL);
  const tools = usePolling<ToolsData>(onTools ? q('/api/insights/tools') : '', POLL);
  const insightMcp = usePolling<InsightsMcp>(onTools ? q('/api/insights/mcp-servers') : '', POLL);
  const insightCommands = usePolling<CommandUsageData>(onTools ? q('/api/insights/commands') : '', POLL);
  const insightSubagents = usePolling<SubagentStats>(onTools ? q('/api/insights/subagents') : '', POLL);
  const insightLanguages = usePolling<InsightsLanguages[]>(onCode ? q('/api/insights/languages') : '', POLL);
  const insightBranches = usePolling<InsightsBranches[]>(onCode ? q('/api/insights/branches') : '', POLL);
  const insightYield = usePolling<InsightsYield>(onCode ? q('/api/insights/yield') : '', POLL);
  const insightChurn = usePolling<FileChurnData>(onCode ? q('/api/insights/churn') : '', POLL);
  const insightComplexity = usePolling<ComplexityPoint[]>(onPace ? q('/api/insights/complexity') : '', POLL);
  const insightTurns = usePolling<InsightsTurns>(onPace ? q('/api/insights/turns') : '', POLL);

  const kpis = useMemo(
    () => buildInsightKpis({ data: summary.data, loading: summary.loading, error: summary.error }, platform),
    [summary.data, summary.loading, summary.error, platform],
  );

  const scope = useMemo<SectionScope>(() => ({ platform, days: insightDays, sectionAi }), [platform, insightDays, sectionAi]);
  const errors = useInsightSection(insightErrors, 'errors', buildErrorBreakdown, scope);
  const rejections = useInsightSection(insightRejections, 'rejections', buildRejections, scope);
  const retries = useInsightSection(insightRetries, 'retries', buildRetries, scope);
  const toolUsage = useInsightSection(tools, 'tools', buildToolUsage, scope);
  const mcp = useInsightSection(insightMcp, 'mcp', buildMcpBreakdown, scope);
  const commands = useInsightSection(insightCommands, 'commands', buildCommandUsage, scope);
  const subagents = useInsightSection(insightSubagents, 'subagents', buildSubagentStats, scope);
  const languages = useInsightSection(insightLanguages, 'languages', buildLanguages, scope);
  const branches = useInsightSection(insightBranches, 'branches', buildBranches, scope);
  const yieldView = useInsightSection(insightYield, 'yield', buildYield, scope);
  const churn = useInsightSection(insightChurn, 'churn', buildFileChurn, scope);
  const complexity = useInsightSection(insightComplexity, 'complexity', buildComplexity, scope);
  const turns = useInsightSection(insightTurns, 'turns', buildTurnLatency, scope);

  const onViewChange = useCallback(
    (next: InsightView) => {
      setParams((current) => {
        const updated = new URLSearchParams(current);
        if (next === DEFAULT_INSIGHT_VIEW) updated.delete(INSIGHT_VIEW_PARAM);
        else updated.set(INSIGHT_VIEW_PARAM, next);
        return updated;
      });
    },
    [setParams],
  );

  const onDaysChange = useCallback((d: InsightDays) => {
    setInsightDays(d);
    track('insight_range_changed', { days: d });
  }, []);

  return {
    view,
    viewTabs: INSIGHT_VIEW_TABS,
    onViewChange,
    days: insightDays,
    dayOptions: INSIGHT_DAY_OPTIONS,
    onDaysChange,
    description: insightsDescription(platform, insightDays),
    kpis,
    errors,
    rejections,
    retries,
    tools: toolUsage,
    mcp,
    commands,
    subagents,
    languages,
    branches,
    yield: yieldView,
    churn,
    complexity,
    turns,
  };
}
