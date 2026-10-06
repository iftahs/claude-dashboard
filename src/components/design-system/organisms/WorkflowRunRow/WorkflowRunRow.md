# WorkflowRunRow

**Level:** Organism
**Purpose:** Card for one finished workflow run: its status, name, summary, model and age on one line, its totals and estimated cost on the next, and expandable details with its phases, agents and log tail.

## When to use

- The date groups of the Workflows page ("Today", "Earlier this week"), one card per run.

## When NOT to use

- A workflow that is still running - use `WorkflowRunCard`, which shows the phases straight away.
- Many runs compared by column - use a `Table`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `WorkflowRecentRunView` | required | The card's view model, built by `buildWorkflowRuns()` in `@/lib/views/workflows`. |
| `onToggle` | `(runId) => void` | required | The "Details" button was clicked. The owner flips `open`. |
| `onSelectPhase` | `(runId, index) => void` | required | A phase was clicked in the details. |
| `onToggleAgent` | `(runId, agentId) => void` | required | An agent row was clicked in the details. |
| `onRetryAgent` | `(runId, agentId) => void` | - | Adds a retry button to an agent detail that failed to load. |
| `className` | `string` | - | Extra classes merged onto the card. |

`WorkflowRecentRunView` fields:

| Field | Type | Description |
|---|---|---|
| `runId`, `name`, `summary` | `string` | The run. `summary` is empty when it only repeats the name. |
| `status`, `statusLabel`, `statusTone` | - | `completed`, `failed`, `running` or `unknown`, with the badge text and tone. |
| `model` | `string \| null` | The run's default model, or `null` when it inherits. |
| `when` | `string` | Age of the last activity: relative under a day, then a date. |
| `meta` | `string[]` | Project, duration, agents, tokens, tool calls and phases, already formatted. |
| `cost`, `costHelp` | `string \| null`, `string` | "~$10.67" and the sentence that says how it was priced. |
| `resultStats` | `{ key, label, value }[]` | The run's own result figures, with readable labels. |
| `expandable`, `open` | `boolean` | Whether there are details, and whether they are shown. |
| `panes`, `log` | `WorkflowPanesView \| null`, `string[]` | The details: phases with agents, and the last log lines. Empty while closed. |

## States

- Closed - the two summary lines and, when the run has them, its result figures.
- Open - the same, then the phases and agents edge to edge and the log tail in a sunken well.
- No details - the "Details" button is not rendered.
- The status icon is a check (completed), a cross (failed) or a dot (running pulses, unknown is neutral), always beside the badge that says it in words.

## Usage

```tsx
import { WorkflowRunRow } from '@/components/design-system/organisms/WorkflowRunRow/WorkflowRunRow';
```

A date group:

```tsx
<SectionStackLayout spacing="sm" title={<GroupLabel>Earlier this week</GroupLabel>}>
  {group.runs.map((run) => (
    <WorkflowRunRow key={run.runId} view={run} onToggle={onToggleRun} onSelectPhase={onSelectPhase} onToggleAgent={onToggleAgent} />
  ))}
</SectionStackLayout>
```

With a retry for agent details:

```tsx
<WorkflowRunRow view={run} onToggle={onToggleRun} onSelectPhase={onSelectPhase} onToggleAgent={onToggleAgent} onRetryAgent={onRetryAgent} />
```

## a11y

- The card is an `<article>` labelled by the run name, which is an `<h3>`.
- The status is a badge with the word; the icon beside it is decoration.
- The estimated cost is focusable and opens a tooltip that says how it was priced.
- "Details" is a button with `aria-expanded`, pointing at the details with `aria-controls` while open; its label switches to "Hide details".

## Notes

- A custom card instead of `Section`: a run is a row in a list, with its status and name on one line, and its details run edge to edge.
- The name keeps up to 45% of the first line and truncates; the summary takes the rest and truncates (full text in `title`); the chip, the badge and the age never wrap. The summary is hidden below `md` and the chip below `sm`.
- The second line wraps as whole items, beside the "Details" button, which keeps its place on the right: no figure is ever cut in two. An item wider than the line (a very long project name) truncates.
- Cost is an estimate: it is written with a tilde and takes the warning text colour, as in the approved mock.
- Presentational and fully controlled: no state, no fetching.
