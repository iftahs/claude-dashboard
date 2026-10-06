import { useCallback, useMemo, useState } from 'react';
import { RankedMeterList } from '@/components/design-system/molecules/RankedMeterList/RankedMeterList';
import { BranchBreakdown } from '@/components/design-system/organisms/BranchBreakdown/BranchBreakdown';
import { CommandUsage } from '@/components/design-system/organisms/CommandUsage/CommandUsage';
import { ComplexityScatter } from '@/components/design-system/organisms/ComplexityScatter/ComplexityScatter';
import { CostCalculation } from '@/components/design-system/organisms/CostCalculation/CostCalculation';
import { EffortBreakdown } from '@/components/design-system/organisms/EffortBreakdown/EffortBreakdown';
import { ErrorBreakdown } from '@/components/design-system/organisms/ErrorBreakdown/ErrorBreakdown';
import { FileChurn } from '@/components/design-system/organisms/FileChurn/FileChurn';
import { InsightKpis } from '@/components/design-system/organisms/InsightKpis/InsightKpis';
import { LanguageBreakdown } from '@/components/design-system/organisms/LanguageBreakdown/LanguageBreakdown';
import { McpBreakdown } from '@/components/design-system/organisms/McpBreakdown/McpBreakdown';
import { ModelBreakdown } from '@/components/design-system/organisms/ModelBreakdown/ModelBreakdown';
import { RejectionsPanel } from '@/components/design-system/organisms/RejectionsPanel/RejectionsPanel';
import { RetryPanel } from '@/components/design-system/organisms/RetryPanel/RetryPanel';
import { Section } from '@/components/design-system/organisms/Section/Section';
import { SubagentStatsPanel } from '@/components/design-system/organisms/SubagentStatsPanel/SubagentStatsPanel';
import { ToolUsage } from '@/components/design-system/organisms/ToolUsage/ToolUsage';
import { TurnLatency } from '@/components/design-system/organisms/TurnLatency/TurnLatency';
import { YieldPanel } from '@/components/design-system/organisms/YieldPanel/YieldPanel';
import { SplitLayout } from '@/components/design-system/templates/SplitLayout/SplitLayout';
import { StatGridLayout } from '@/components/design-system/templates/StatGridLayout/StatGridLayout';
import { sanitizeTokenInput, type ExpandedGroups, type PricePlatform, type TokenField, type TokenInputs } from '@/lib/views/models';
import { Specimen } from '../../Specimen/Specimen';
import {
  BRANCH_VIEWS,
  CHURN_VIEWS,
  COMMAND_VIEWS,
  COMPLEXITY_VIEWS,
  DETAIL_ROWS,
  EFFORT_VIEWS,
  ERROR_VIEWS,
  KPI_VIEWS,
  LANGUAGE_VIEWS,
  LATENCY_VIEWS,
  MCP_VIEWS,
  MODEL_VIEWS,
  PLAIN_ROWS,
  REJECTION_VIEWS,
  RETRY_VIEWS,
  SUBAGENT_VIEWS,
  SWATCH_ROWS,
  TOKEN_DEFAULTS,
  TONED_ROWS,
  TOOL_VIEWS,
  YIELD_VIEWS,
  groupToExpand,
  pricingView,
} from './utils';

export function InsightsModelsSpecimens() {
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<ExpandedGroups>({});
  const [inputs, setInputs] = useState<TokenInputs>(TOKEN_DEFAULTS);

  const onSelectModel = useCallback((name: string) => {
    setSelectedName(name);
    const group = groupToExpand(name);
    if (group) setExpanded((current) => ({ ...current, [group]: true }));
  }, []);
  const onToggleGroup = useCallback((group: PricePlatform) => {
    setExpanded((current) => ({ ...current, [group]: !current[group] }));
  }, []);
  const onTokensChange = useCallback((field: TokenField, value: string) => {
    setInputs((current) => ({ ...current, [field]: sanitizeTokenInput(value) }));
  }, []);
  const onReset = useCallback(() => setInputs(TOKEN_DEFAULTS), []);
  const pricing = useMemo(() => pricingView('both', selectedName, expanded, inputs), [selectedName, expanded, inputs]);

  return (
    <>
      <Specimen
        name="RankedMeterList"
        note="Plain with a long name, two value columns with tones, series swatches, and a badge with a detail"
        layout="stack"
      >
        <SplitLayout>
          <Section title="Calls by tool" description="Monospace names, the widest label cap" as="h3">
            <RankedMeterList ariaLabel="Calls by tool" rows={PLAIN_ROWS} mono labelWidth="xl" />
          </Section>
          <Section title="Failures by tool" description="Failed out of calls, then the tool's own rate" as="h3">
            <RankedMeterList ariaLabel="Failures by tool" rows={TONED_ROWS} tone="danger" labelWidth="lg" />
          </Section>
          <Section title="Est. cost per 1M effective tokens" description="A swatch carries the series colour" as="h3">
            <RankedMeterList ariaLabel="Est. cost per 1M effective tokens" rows={SWATCH_ROWS} />
          </Section>
          <Section title="Commands and files" description="A badge marks the kind, a detail follows the name" as="h3">
            <RankedMeterList ariaLabel="Commands and files" rows={DETAIL_ROWS} mono labelWidth="lg" />
          </Section>
        </SplitLayout>
      </Specimen>

      <Specimen name="InsightKpis" note="Claude, Codex, both platforms, loading and failed" layout="stack">
        {KPI_VIEWS.map((view, index) => (
          <StatGridLayout key={index}>
            <InsightKpis view={view} />
          </StatGridLayout>
        ))}
      </Specimen>

      <Specimen name="ErrorBreakdown" note="Both platforms with a clipped tool list, then loading, failed and empty" layout="stack">
        <ErrorBreakdown view={ERROR_VIEWS.ready} />
        <SplitLayout columns={3}>
          {ERROR_VIEWS.states.map((view, index) => (
            <ErrorBreakdown key={index} view={view} />
          ))}
        </SplitLayout>
      </Specimen>

      <Specimen name="RejectionsPanel" note="Claude prompts, both deciders counted apart, and nothing rejected under Codex" layout="stack">
        <SplitLayout columns={3}>
          {REJECTION_VIEWS.map((view, index) => (
            <RejectionsPanel key={index} view={view} />
          ))}
        </SplitLayout>
      </Specimen>

      <Specimen name="RetryPanel" note="A one-shot rate, not applicable under Codex, no edits, and loading" layout="stack">
        <SplitLayout>
          {RETRY_VIEWS.map((view, index) => (
            <RetryPanel key={index} view={view} />
          ))}
        </SplitLayout>
      </Specimen>

      <Specimen name="ToolUsage" note="Twelve tools with long MCP names, then loading, failed and empty" layout="stack">
        <SplitLayout>
          <ToolUsage view={TOOL_VIEWS.ready} />
          <McpBreakdown view={MCP_VIEWS[0]} />
        </SplitLayout>
        <SplitLayout columns={3}>
          {TOOL_VIEWS.states.map((view, index) => (
            <ToolUsage key={index} view={view} />
          ))}
        </SplitLayout>
      </Specimen>

      <Specimen name="McpBreakdown" note="No MCP calls under Codex, and a failed request" layout="stack">
        <SplitLayout>
          {MCP_VIEWS.slice(1).map((view, index) => (
            <McpBreakdown key={index} view={view} />
          ))}
        </SplitLayout>
      </Specimen>

      <Specimen name="CommandUsage" note="Slash commands and skills, then Codex, which records neither" layout="stack">
        <SplitLayout>
          {COMMAND_VIEWS.map((view, index) => (
            <CommandUsage key={index} view={view} />
          ))}
        </SplitLayout>
      </Specimen>

      <Specimen name="SubagentStatsPanel" note="Both platforms, Codex guardian reviews, and nothing spawned" layout="stack">
        <SplitLayout columns={3}>
          {SUBAGENT_VIEWS.map((view, index) => (
            <SubagentStatsPanel key={index} view={view} />
          ))}
        </SplitLayout>
      </Specimen>

      <Specimen name="LanguageBreakdown" note="Edits with reads, then no edits" layout="stack">
        <SplitLayout>
          {LANGUAGE_VIEWS.map((view, index) => (
            <LanguageBreakdown key={index} view={view} />
          ))}
        </SplitLayout>
      </Specimen>

      <Specimen name="BranchBreakdown" note="Branches with a long name and a zero cost, then Codex with no repo" layout="stack">
        <SplitLayout>
          {BRANCH_VIEWS.map((view, index) => (
            <BranchBreakdown key={index} view={view} />
          ))}
        </SplitLayout>
      </Specimen>

      <Specimen name="YieldPanel" note="The funnel with its PR note and uncommitted sessions, then no sessions" layout="stack">
        <SplitLayout>
          {YIELD_VIEWS.map((view, index) => (
            <YieldPanel key={index} view={view} />
          ))}
        </SplitLayout>
      </Specimen>

      <Specimen name="FileChurn" note="Files with their projects, then a failed request" layout="stack">
        <SplitLayout>
          {CHURN_VIEWS.map((view, index) => (
            <FileChurn key={index} view={view} />
          ))}
        </SplitLayout>
      </Specimen>

      <Specimen name="ComplexityScatter" note="Both platforms with a legend, Codex alone, then loading and empty" layout="stack">
        <ComplexityScatter view={COMPLEXITY_VIEWS.both} />
        <SplitLayout columns={3}>
          <ComplexityScatter view={COMPLEXITY_VIEWS.codex} />
          {COMPLEXITY_VIEWS.states.map((view, index) => (
            <ComplexityScatter key={index} view={view} />
          ))}
        </SplitLayout>
      </Specimen>

      <Specimen name="TurnLatency" note="One platform, both platforms stacked, then loading and failed" layout="stack">
        <TurnLatency view={LATENCY_VIEWS.claude} />
        <TurnLatency view={LATENCY_VIEWS.both} />
        <SplitLayout>
          {LATENCY_VIEWS.states.map((view, index) => (
            <TurnLatency key={index} view={view} />
          ))}
        </SplitLayout>
      </Specimen>

      <Specimen name="ModelBreakdown" note="Six models with an unpriced one, then no usage and loading" layout="stack">
        <SplitLayout columns={3}>
          {MODEL_VIEWS.map((view, index) => (
            <ModelBreakdown key={index} view={view} />
          ))}
        </SplitLayout>
      </Specimen>

      <Specimen name="EffortBreakdown" note="Every effort level and Not logged, partial reasoning coverage, then empty and failed" layout="stack">
        <SplitLayout columns={3}>
          {EFFORT_VIEWS.map((view, index) => (
            <EffortBreakdown key={index} view={view} />
          ))}
        </SplitLayout>
      </Specimen>

      <Specimen name="CostCalculation" note="Both rate cards. Pick a row or a model, change the token counts, reset." layout="stack">
        <CostCalculation
          view={pricing}
          onSelectModel={onSelectModel}
          onToggleGroup={onToggleGroup}
          onTokensChange={onTokensChange}
          onReset={onReset}
        />
      </Specimen>
    </>
  );
}
