# AI Usage Design System - Component Index

This is the entry point to the AI Usage design system. Before building or changing any UI, find
the component you need below, open its linked `ComponentName.md` for props, variants and usage,
and build from that doc. Do not read the component's `.tsx` source - the `.md` holds what you need
and reading source wastes tokens. If nothing here fits, compose existing atoms and molecules
rather than writing raw markup.

- **Design system** (this index): `src/components/design-system/{atoms,molecules,organisms,templates}/<Name>/`
- **Pages**: `src/pages/<Name>Page/` - one component per screen, a template plus design-system
  components, wired through one page hook.
- **Connected components**: `src/components/common/<Name>/` - bind design-system components to
  real data through hooks.
- **Hooks**: `src/hooks/` - all business logic (fetching, polling, storage, analytics); page hooks
  are `src/hooks/use<Name>Page.ts`.
- **Tokens**: `src/styles/tokens.css` - semantic CSS variables with dark and light values, mapped
  to Tailwind classes in `tailwind.config.js`.
- **Visual rules** come from the "AI Usage Design System": calm and minimal, clay as the single
  accent, 12px minimum text, no raw hex - colours only through tokens.

<!-- generated:start -->
## Atoms

| Component | Purpose | Doc |
|---|---|---|
| ActivityBars | Tiny three-bar equalizer that moves while something is running, drawn in the current text colour. | [ActivityBars.md](atoms/ActivityBars/ActivityBars.md) |
| Badge | Short status or count label on a soft tinted fill. | [Badge.md](atoms/Badge/Badge.md) |
| Button | Triggers an action with a text label, optionally led by an icon passed as a child. | [Button.md](atoms/Button/Button.md) |
| Card | Flat surface container with a hairline border and a 10px radius that holds one block of content. | [Card.md](atoms/Card/Card.md) |
| Checkbox | Labelled box that switches one setting on or off, or picks one of several independent choices. | [Checkbox.md](atoms/Checkbox/Checkbox.md) |
| Chip | Compact monospace tag for a model, project or other identifier, with an optional colour dot. | [Chip.md](atoms/Chip/Chip.md) |
| ElapsedTime | Ticking text that shows how long ago a moment was, as a running duration or as a relative time. | [ElapsedTime.md](atoms/ElapsedTime/ElapsedTime.md) |
| GroupLabel | Uppercase section heading in the label style, with an optional quiet note after it. | [GroupLabel.md](atoms/GroupLabel/GroupLabel.md) |
| Icon | Draws one Lucide glyph by name at a fixed size with a 1.5 stroke in the current text colour. | [Icon.md](atoms/Icon/Icon.md) |
| IconButton | Square button that shows only an icon and carries its name in a required label. | [IconButton.md](atoms/IconButton/IconButton.md) |
| InfoTip | Small help-icon button that opens a short explanation in a popover on click. | [InfoTip.md](atoms/InfoTip/InfoTip.md) |
| Input | Single-line text field outlined in the control border, with an invalid state. | [Input.md](atoms/Input/Input.md) |
| Kbd | Shows a keyboard shortcut hint as a small bordered key cap in monospace. | [Kbd.md](atoms/Kbd/Kbd.md) |
| LegendDot | One chart legend entry: a colour swatch, the series name and an optional value. | [LegendDot.md](atoms/LegendDot/LegendDot.md) |
| Markdown | Renders a safe subset of markdown from model output as React elements, never as raw HTML. | [Markdown.md](atoms/Markdown/Markdown.md) |
| PageHeader | Row under the topbar that pairs a one-line page description, or other left content, with the page's actions on the right. | [PageHeader.md](atoms/PageHeader/PageHeader.md) |
| ProgressBar | Horizontal meter that fills a rounded track to a percentage in a status tone. | [ProgressBar.md](atoms/ProgressBar/ProgressBar.md) |
| SegmentedControl | Row of two to five always-visible options on a neutral track, one of which is selected. | [SegmentedControl.md](atoms/SegmentedControl/SegmentedControl.md) |
| Select | Dropdown that picks one value from a short list of options, with a trigger styled like an input. | [Select.md](atoms/Select/Select.md) |
| SettingRow | One setting inside a settings card: its name and a sentence of explanation beside the control that changes it, with room for extra content underneath. | [SettingRow.md](atoms/SettingRow/SettingRow.md) |
| Skeleton | One shimmering placeholder block that stands in for content while it loads. | [Skeleton.md](atoms/Skeleton/Skeleton.md) |
| Sparkline | Draws a tiny bar trend from a list of numbers, with no axes, labels or tooltip. | [Sparkline.md](atoms/Sparkline/Sparkline.md) |
| StatusDot | Small round dot that shows a status tone, with an optional live pulse and screen-reader label. | [StatusDot.md](atoms/StatusDot/StatusDot.md) |
| SweepBar | Thin indeterminate progress line whose segment travels left to right while something is running. | [SweepBar.md](atoms/SweepBar/SweepBar.md) |
| Table | Full-width table element that sets the base type and holds header and body rows. | [Table.md](atoms/Table/Table.md) |
| TableCell | Table cell that renders a column header, a text cell or a right-aligned monospace number. | [TableCell.md](atoms/TableCell/TableCell.md) |
| TableRow | Table row with a top hairline, an optional hover fill and a selected state. | [TableRow.md](atoms/TableRow/TableRow.md) |
| Tabs | Underlined tab list that switches between the views of one page, with the panels rendered by the consumer. | [Tabs.md](atoms/Tabs/Tabs.md) |
| Tooltip | Shows a short floating explanation when its trigger is hovered or focused. | [Tooltip.md](atoms/Tooltip/Tooltip.md) |

## Molecules

| Component | Purpose | Doc |
|---|---|---|
| AiInsightButton | Small ghost button with the sparkles icon that asks the model to explain the section it sits on, with a busy state while the answer is on its way. | [AiInsightButton.md](molecules/AiInsightButton/AiInsightButton.md) |
| AiInsightInline | Result block for an AI explanation under a card's content: a label with the backend that answered, a dismiss button, and the answer as markdown, as skeleton lines while it loads or as an error message. | [AiInsightInline.md](molecules/AiInsightInline/AiInsightInline.md) |
| Callout | Inline notice inside a page or a card: an icon, an optional title and a sentence on a soft status fill, with an optional action. | [Callout.md](molecules/Callout/Callout.md) |
| CardHeader | Top row of a card: its title and one-line description on the left, a help popover beside the title and an actions slot on the right. | [CardHeader.md](molecules/CardHeader/CardHeader.md) |
| ChartTooltip | Floating read-out for a chart's hovered point: a title, one row per series with its value, and an optional footer. | [ChartTooltip.md](molecules/ChartTooltip/ChartTooltip.md) |
| Dialog | Modal panel over a dimmed page with a title, a scrolling body, an optional footer of actions and a close button. | [Dialog.md](molecules/Dialog/Dialog.md) |
| DropdownMenu | Menu of actions that opens from a trigger element, with an optional icon, a danger tone and a disabled state per item. | [DropdownMenu.md](molecules/DropdownMenu/DropdownMenu.md) |
| EmptyState | Centred icon, title and sentence that say what is missing and what makes it appear, with an optional action. | [EmptyState.md](molecules/EmptyState/EmptyState.md) |
| ErrorState | Centred alert that says what failed and what to do, with an optional retry button. | [ErrorState.md](molecules/ErrorState/ErrorState.md) |
| FormField | Wraps one form control with its label and a helper line that an error message replaces. | [FormField.md](molecules/FormField/FormField.md) |
| KeyValueRow | One fact on a line: a muted label on the left and its value in monospace on the right, with an optional help popover and a status tone for the value. | [KeyValueRow.md](molecules/KeyValueRow/KeyValueRow.md) |
| Legend | Wrapping row of chart legend entries, each a colour swatch with the series name and an optional value. | [Legend.md](molecules/Legend/Legend.md) |
| LiveStatus | Status dot and a caption that say whether the page is receiving live data, paused or failing. | [LiveStatus.md](molecules/LiveStatus/LiveStatus.md) |
| MeterRow | Labelled meter: a name on the left, its value in monospace on the right, a progress bar underneath and an optional note. | [MeterRow.md](molecules/MeterRow/MeterRow.md) |
| ModelChip | Chip that names a model in its short form with that model's fixed series colour, or a plain "inherit" chip when no model is set. | [ModelChip.md](molecules/ModelChip/ModelChip.md) |
| NavItem | Sidebar link with an icon, a label and an optional badge, which collapses to an icon with a tooltip in the rail. | [NavItem.md](molecules/NavItem/NavItem.md) |
| RankedMeterList | Ranked list where every row is a name, a thin bar drawn against the largest row and its value in monospace, with the columns lined up down the list. | [RankedMeterList.md](molecules/RankedMeterList/RankedMeterList.md) |
| SkeletonPreset | Ready-made loading placeholder in the shape of common content: text, a stat, a chart, meter rows, a table or a limit gauge. | [SkeletonPreset.md](molecules/SkeletonPreset/SkeletonPreset.md) |
| StatTile | Card that shows one number under an uppercase label, with an optional line of context and a help popover. | [StatTile.md](molecules/StatTile/StatTile.md) |
| StatusChip | Compact link on a soft status fill that names a live state and leads to the page that explains it. | [StatusChip.md](molecules/StatusChip/StatusChip.md) |
| TagEditor | Row of a project's custom tags, each one renamable and removable, with a button that turns into a text field to add another. | [TagEditor.md](molecules/TagEditor/TagEditor.md) |
| ThemeToggle | Icon button that switches between the dark and light themes and names the theme it switches to. | [ThemeToggle.md](molecules/ThemeToggle/ThemeToggle.md) |
| Toast | Floating notice with a status icon, a title and a sentence, an optional action and a dismiss button. | [Toast.md](molecules/Toast/Toast.md) |

## Organisms

| Component | Purpose | Doc |
|---|---|---|
| ActivityHeatmap | Card with a calendar of the last 18 weeks, one square per day shaded by its effective tokens and marked with the day of the month and the day's total, under a sentence that names the busiest day. | [ActivityHeatmap.md](organisms/ActivityHeatmap/ActivityHeatmap.md) |
| ActivitySummary | The four all-history activity numbers as stat tiles: lifetime effective tokens, the peak day, the current streak and the count of active days, each with its context and, under both platforms, the Claude and Codex split. | [ActivitySummary.md](organisms/ActivitySummary/ActivitySummary.md) |
| AgentActivity | Card that shows one platform's agents working right now: each main session or thread with its state, its running subagents nested beneath it and the ones that just finished. | [AgentActivity.md](organisms/AgentActivity/AgentActivity.md) |
| AgentHistoryStrip | Card that sums up one platform's subagent use over a period: how many were spawned, how many per session that delegated, the share of sessions that delegated, and which types did the work. | [AgentHistoryStrip.md](organisms/AgentHistoryStrip/AgentHistoryStrip.md) |
| AiChat | Chat surface for asking questions about usage: a scrolling list of questions and markdown answers, suggested questions, and a composer pinned to the bottom of the card. | [AiChat.md](organisms/AiChat/AiChat.md) |
| AiSettings | Settings card for AI insights: the provider, the model and the API key that power the AI chat and the AI button on each card. | [AiSettings.md](organisms/AiSettings/AiSettings.md) |
| AlertSettings | Settings card for the dashboard's three kinds of alerts: an agent waiting on you, a plan limit crossing a threshold, and spend crossing a spending cap. | [AlertSettings.md](organisms/AlertSettings/AlertSettings.md) |
| BranchBreakdown | Card that lists the git branches the work went into, each as repo and branch with its effective tokens, estimated cost and session count over a bar. | [BranchBreakdown.md](organisms/BranchBreakdown/BranchBreakdown.md) |
| CacheEfficiencyChart | Card with the share of tokens served from the prompt cache per day as a line over the selected range, one line per platform when two are compared, with the average and peak rates above it. | [CacheEfficiencyChart.md](organisms/CacheEfficiencyChart/CacheEfficiencyChart.md) |
| CodexDailyCompareChart | Card that sets OpenAI's own per-day token count for the account beside the sum of the local Codex rollouts, with both totals and how far the local sum sits from the server figure. | [CodexDailyCompareChart.md](organisms/CodexDailyCompareChart/CodexDailyCompareChart.md) |
| CommandPalette | Modal search box that filters grouped commands as the reader types and runs the chosen one from the keyboard or with a click. | [CommandPalette.md](organisms/CommandPalette/CommandPalette.md) |
| CommandUsage | Card that ranks the slash commands you typed and the skills that ran, with a badge on the skill rows. | [CommandUsage.md](organisms/CommandUsage/CommandUsage.md) |
| ComplexityScatter | Card with one dot per session, placed by tool calls and effective tokens and sized by the subagents it spawned or the guardian reviews it got, so the heaviest sessions stand out. | [ComplexityScatter.md](organisms/ComplexityScatter/ComplexityScatter.md) |
| CostCalculation | Card that explains the estimated cost figures: the list prices per million tokens for each model, a note on prompt caching, and a calculator that prices a hypothetical request for the selected model. | [CostCalculation.md](organisms/CostCalculation/CostCalculation.md) |
| DailyTrendChart | Card with usage per day over the selected range, stacked by model, in effective tokens or estimated cost, with projected days, a today marker and the change against the previous period. | [DailyTrendChart.md](organisms/DailyTrendChart/DailyTrendChart.md) |
| DataSettings | Settings card for what the dashboard keeps, sends and reads: the history archive with its forget action, the telemetry opt-out, the data folders and the installed version. | [DataSettings.md](organisms/DataSettings/DataSettings.md) |
| DisplaySettings | Settings card for how the dashboard looks and counts: the first day of the week and the dark or light theme. | [DisplaySettings.md](organisms/DisplaySettings/DisplaySettings.md) |
| EffortBreakdown | Card that splits effective tokens by the reasoning-effort level each response ran at: one stacked bar for all models with its legend, then each model's mix with its estimated cost and reasoning share. | [EffortBreakdown.md](organisms/EffortBreakdown/EffortBreakdown.md) |
| ErrorBreakdown | Card that breaks down the tool calls that ran and failed: by failure category, by tool with each tool's own failure rate, and as a line of failures per day. | [ErrorBreakdown.md](organisms/ErrorBreakdown/ErrorBreakdown.md) |
| ExportMenu | Small "Export" button that opens a menu with two choices, CSV and JSON, and reports the chosen format. | [ExportMenu.md](organisms/ExportMenu/ExportMenu.md) |
| ExtraUsageCard | Card for paying beyond the plan: Anthropic extra usage credits against their monthly limit, or the ChatGPT credit balance and reset credits, or a sentence saying why it is off. | [ExtraUsageCard.md](organisms/ExtraUsageCard/ExtraUsageCard.md) |
| FileChurn | Card that ranks the files edited most often in the window, each with the project it belongs to, a bar and its edit count. | [FileChurn.md](organisms/FileChurn/FileChurn.md) |
| GeneralSettings | Settings card for how the dashboard reads your accounts: the Claude usage mode with what was detected, and the read-only status of the Codex login. | [GeneralSettings.md](organisms/GeneralSettings/GeneralSettings.md) |
| GroupedBarChart | Bar chart that sets two or more series side by side per bucket, in tokens or estimated cost, with a legend that carries each series' total. | [GroupedBarChart.md](organisms/GroupedBarChart/GroupedBarChart.md) |
| HourlyUsageChart | Card with the effective tokens used in each recent hour, stacked by model, with its own loading, error and empty states. | [HourlyUsageChart.md](organisms/HourlyUsageChart/HourlyUsageChart.md) |
| InsightKpis | The four headline rates of the Insights page as stat tiles: failure rate, rejection rate, commit rate and delegation or auto-review rate. | [InsightKpis.md](organisms/InsightKpis/InsightKpis.md) |
| LanguageBreakdown | Card that ranks the languages the work touched, by file extension: edits and writes as a bar and a count, with reads as a quieter second number. | [LanguageBreakdown.md](organisms/LanguageBreakdown/LanguageBreakdown.md) |
| LimitContributors | Card that says what is driving limit usage over the last day or week: headline behaviours in a sentence each, then the share taken by skills, subagents, plugins and MCP servers. | [LimitContributors.md](organisms/LimitContributors/LimitContributors.md) |
| LimitGauge | Card for one platform's current rate-limit window: the share used as a large number over a meter, when the window started and resets, and the local facts behind it such as tokens, estimated cost, previous window and pace. | [LimitGauge.md](organisms/LimitGauge/LimitGauge.md) |
| LimitGlance | Card that shows one platform's plan limits at a glance: a row per rate-limit window with its percentage, meter and reset time, or the spending caps when there are no plan windows. | [LimitGlance.md](organisms/LimitGlance/LimitGlance.md) |
| LimitHitsCard | Card that counts how often a usage limit blocked work: hits in the last 7 and 30 days, whether one is blocking right now, and the most recent episodes with what was hit and for how long. | [LimitHitsCard.md](organisms/LimitHitsCard/LimitHitsCard.md) |
| LiteLlmBilledCard | Card with what a LiteLLM gateway actually billed: the month-to-date total with its request facts, the spend of each day in the selected range as a bar chart, and the month's token mix. | [LiteLlmBilledCard.md](organisms/LiteLlmBilledCard/LiteLlmBilledCard.md) |
| McpBreakdown | Card that splits tool calls between the agent's built-in tools and tools from MCP servers, with a table of calls and errors per server. | [McpBreakdown.md](organisms/McpBreakdown/McpBreakdown.md) |
| ModelBreakdown | Card with a donut of effective tokens by model in each model's fixed colour, a list of every model's tokens and share, and the estimated cost per million effective tokens. | [ModelBreakdown.md](organisms/ModelBreakdown/ModelBreakdown.md) |
| PeakHoursHeatmap | Card with a seven-day by 24-hour grid of effective tokens, where darker cells are the busiest hours of the week, under a sentence that names the single busiest hour. | [PeakHoursHeatmap.md](organisms/PeakHoursHeatmap/PeakHoursHeatmap.md) |
| PlanLimitsCard | Card with every rate-limit window one plan reports, each as a meter with its share used and reset time, plus the weekly forecast, the split by surface, gated premium models and the plan name. | [PlanLimitsCard.md](organisms/PlanLimitsCard/PlanLimitsCard.md) |
| PlatformDailyCompareChart | Card that sets Claude beside Codex day by day over the selected range, in effective tokens or estimated cost, with each platform's total and Codex's share. | [PlatformDailyCompareChart.md](organisms/PlatformDailyCompareChart/PlatformDailyCompareChart.md) |
| PluginsInventory | Card that lists the integrations installed on this machine as groups of chips with a count each: MCP servers, plugins, marketplaces, skills, automations and hooks. | [PluginsInventory.md](organisms/PluginsInventory/PluginsInventory.md) |
| ProfileCard | Card that shows how one platform is configured on this machine: its default model and plan as facts, its switches as status badges, and the lists it has authorized. | [ProfileCard.md](organisms/ProfileCard/ProfileCard.md) |
| ProjectBreakdown | Card that ranks projects by estimated cost, active time, tokens or files changed, each with a bar, its session count and an editor for the project's custom tags. | [ProjectBreakdown.md](organisms/ProjectBreakdown/ProjectBreakdown.md) |
| RejectionsPanel | Card that lists the tool calls that never ran, by tool: permission prompts you declined and actions the Codex guardian denied, with who said no counted apart. | [RejectionsPanel.md](organisms/RejectionsPanel/RejectionsPanel.md) |
| RetryPanel | Card that shows how often an edit worked first time: the one-shot rate as a large number, then the retried edits and the tokens and estimated cost the retries wasted. | [RetryPanel.md](organisms/RetryPanel/RetryPanel.md) |
| RunningNow | Card that summarises what is running right now: counts of running agents, agents waiting on you and running workflows, then a short list of the sessions and workflows behind them. | [RunningNow.md](organisms/RunningNow/RunningNow.md) |
| Section | The standard data card of a page: a titled card with a description, help, an actions slot and an AI explanation, whose body shows the content or a built-in loading, error or empty state. | [Section.md](organisms/Section/Section.md) |
| SessionDetail | Dialog for one session or thread: its title, project and start time, the facts of what it did, its pull requests and tool counts, and its transcript behind a toggle. | [SessionDetail.md](organisms/SessionDetail/SessionDetail.md) |
| SessionSearchStrip | Search field for the session history with the transcript matches listed under it: each hit names its session, project, date and match count over one line of the matching text, and opens that session. | [SessionSearchStrip.md](organisms/SessionSearchStrip/SessionSearchStrip.md) |
| SessionStatsGrid | The four session totals as stat tiles: how many sessions, the longest active one, the median turn time and the lines changed, each with a Claude and Codex split under Both. | [SessionStatsGrid.md](organisms/SessionStatsGrid/SessionStatsGrid.md) |
| SessionTable | Card with the session history as a paged table: start time, project, title or first prompt, duration and effective tokens per row, where a row opens that session's detail. | [SessionTable.md](organisms/SessionTable/SessionTable.md) |
| Sidebar | App navigation: the product name with the collapse button, grouped page links with live badges, pinned links at the bottom and a footer with the data folders, version and credit. | [Sidebar.md](organisms/Sidebar/Sidebar.md) |
| SourcesSplitChart | Card that splits the range's effective tokens between surfaces, or between Codex thread kinds, as one segmented bar over a row per part with its tokens, share and estimated cost. | [SourcesSplitChart.md](organisms/SourcesSplitChart/SourcesSplitChart.md) |
| SpendCapsCard | Card that sets today's, this week's and this month's spend against the spending caps from Settings, one meter per capped period. | [SpendCapsCard.md](organisms/SpendCapsCard/SpendCapsCard.md) |
| SpendingCapsSettings | Settings card for the spending caps: a daily, weekly and monthly amount in US dollars per platform, each platform saved or cleared on its own. | [SpendingCapsSettings.md](organisms/SpendingCapsSettings/SpendingCapsSettings.md) |
| SpendKpiTiles | The four headline spend numbers of the selected range as stat tiles: estimated cost, effective tokens, average cost per day and the month-end projection, each with a line of context and, under both platforms, the Claude and Codex split. | [SpendKpiTiles.md](organisms/SpendKpiTiles/SpendKpiTiles.md) |
| SpendToday | Card that shows one of today's totals as a large number with its change against the recent daily average, a seven-day sparkline, and an optional daily cap meter and platform split. | [SpendToday.md](organisms/SpendToday/SpendToday.md) |
| SubagentStatsPanel | Card that counts the window's subagent spawns and Codex guardian reviews, then breaks them down by subagent type and by model. | [SubagentStatsPanel.md](organisms/SubagentStatsPanel/SubagentStatsPanel.md) |
| TagBreakdown | Card that splits estimated cost by the custom tags given to projects: a donut of the shares over a list with each tag's cost, share and tokens, with untagged projects as their own entry. | [TagBreakdown.md](organisms/TagBreakdown/TagBreakdown.md) |
| TasksPanel | Card with two lists side by side: the tasks the coding agent is tracking, each with its status, and the plan documents it saved, each with its size and age. | [TasksPanel.md](organisms/TasksPanel/TasksPanel.md) |
| ToastStack | Stack of toasts pinned to the bottom right of the viewport, oldest on top, each with its own dismiss button and optional action. | [ToastStack.md](organisms/ToastStack/ToastStack.md) |
| ToolUsage | Card that ranks the tools the agent called in the window, each with a bar against the most-used tool and its call count. | [ToolUsage.md](organisms/ToolUsage/ToolUsage.md) |
| Topbar | Row of global controls for the app shell: the page title, the platform and surface switchers, limit and agent status chips, the command palette button, the theme toggle and the live indicator. | [Topbar.md](organisms/Topbar/Topbar.md) |
| TranscriptPane | The messages of one session or thread in order: who spoke and when, the model that answered, the text, and each tool call in a monospace well, with loading, error, archived and empty states. | [TranscriptPane.md](organisms/TranscriptPane/TranscriptPane.md) |
| TurnLatency | Card that shows how long turns take: the median and 90th-percentile turn and time to first token, with a histogram of turns by duration. | [TurnLatency.md](organisms/TurnLatency/TurnLatency.md) |
| UsageBarChart | Stacked bar chart of usage over time, one bar per bucket and one segment per model, in effective tokens or estimated cost, with optional projected bars and a today marker. | [UsageBarChart.md](organisms/UsageBarChart/UsageBarChart.md) |
| WorkflowPhasePanes | Two panes for one workflow run: its phases on the left and the agents of the selected phase on the right, where each agent row expands to its detail. | [WorkflowPhasePanes.md](organisms/WorkflowPhasePanes/WorkflowPhasePanes.md) |
| WorkflowRunCard | Card for one running workflow: a header with its status, name, summary, agent progress and running time, over its phases and the agents of the selected phase. | [WorkflowRunCard.md](organisms/WorkflowRunCard/WorkflowRunCard.md) |
| WorkflowRunRow | Card for one finished workflow run: its status, name, summary, model and age on one line, its totals and estimated cost on the next, and expandable details with its phases, agents and log tail. | [WorkflowRunRow.md](organisms/WorkflowRunRow/WorkflowRunRow.md) |
| WorkflowStatsGrid | The nine all-time workflow totals as stat tiles: runs, success rate, tokens, agents, average duration, estimated cost, tool calls, top model and busiest day. | [WorkflowStatsGrid.md](organisms/WorkflowStatsGrid/WorkflowStatsGrid.md) |
| YieldPanel | Card that follows the window's sessions down a funnel, from every session to those in a git repo, those that committed and those that opened a pull request, with the tokens behind each outcome and the largest uncommitted sessions. | [YieldPanel.md](organisms/YieldPanel/YieldPanel.md) |

## Templates

| Component | Purpose | Doc |
|---|---|---|
| AppShellLayout | Application frame with a sidebar column, a sticky topbar and a scrolling main area, where the sidebar becomes a modal drawer below 1024px. | [AppShellLayout.md](templates/AppShellLayout/AppShellLayout.md) |
| PageLayout | Centres page content inside the shell's main area at the content max width, with the page gutters and a 24px rhythm between sections. | [PageLayout.md](templates/PageLayout/PageLayout.md) |
| SectionStackLayout | Vertical stack that groups cards under an optional section title. | [SectionStackLayout.md](templates/SectionStackLayout/SectionStackLayout.md) |
| SplitLayout | Places content side by side in two or three columns that collapse to a single column on narrow screens. | [SplitLayout.md](templates/SplitLayout/SplitLayout.md) |
| StatGridLayout | Responsive grid that lays stat tiles out in two to six equal columns with 16px between them. | [StatGridLayout.md](templates/StatGridLayout/StatGridLayout.md) |
<!-- generated:end -->

## Notes

- Everything between the `generated` markers is written by `node scripts/generate-design-index.mjs`
  from each component's `**Purpose:**` line. Never edit it by hand - edit the component's `.md`
  and regenerate.
- `node scripts/check-design-system.mjs` enforces the rules below and fails on a stale index.
- Tiers are decided by imports: an atom imports no other design-system component, a molecule
  imports only atoms, an organism imports atoms, molecules and organisms, a template (always named
  `<Name>Layout`) imports atoms, molecules and organisms and holds layout only.
- Every component folder holds `<Name>.tsx` (one exported component), `types.ts` and `<Name>.md`,
  plus `utils.ts` and `<Name>.variants.ts` when needed. No `index.ts` barrels - import by deep
  path (`@/components/design-system/atoms/Button/Button`). A folder's `utils.ts` serves only that
  folder.
- Business logic lives in hooks. Design-system components hold UI-only state (open/closed, hover,
  copied) and never poll, fetch, read storage, track analytics or route.
- Theming goes through tokens: no raw hex, no `dark:` variants, no arbitrary `text-[Npx]` sizes,
  and none of the old `ink-*` / `clay-*` / `zinc-*` palette classes.
- Pages and connected components are not listed here - they are not reusable parts.
