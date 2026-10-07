# WorkflowPhasePanes

**Level:** Organism
**Purpose:** Two panes for one workflow run: its phases on the left and the agents of the selected phase on the right, where each agent row expands to its detail.

## When to use

- Inside `WorkflowRunCard`, under the header of a live run.
- Inside `WorkflowRunRow`, as the expanded details of a finished run.

## When NOT to use

- On its own as a card: it has no surface, border or title. Wrap it in a card that names the run.
- A flat list of agents with no phases - use `AgentActivity`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `WorkflowPanesView` | required | The panes' view model, part of a run view built by `buildWorkflowRuns()` in `@/lib/views/workflows`. |
| `onSelectPhase` | `(runId, index) => void` | required | Called when a phase is clicked. The owner stores the choice and passes back `selected`. |
| `onToggleAgent` | `(runId, agentId) => void` | required | Called when an agent row is clicked. The owner flips `open` and loads the detail. |
| `onRetryAgent` | `(runId, agentId) => void` | - | Adds a retry button to a detail that failed to load. |
| `className` | `string` | - | Extra classes merged onto the grid. |

`WorkflowPanesView` fields:

| Field | Type | Description |
|---|---|---|
| `runId` | `string` | Passed back to every handler. |
| `phases` | `WorkflowPhaseView[]` | `title`, `state` (`done`, `running`, `partial`, `pending`), `count` ("4/4", or `null` before the phase starts) and `selected`. |
| `note` | `string \| null` | Quiet text after the "Phases" label, such as "2 running". |
| `selected` | `{ title, summary, agents } \| null` | The selected phase: its title, "4 agents", and one `WorkflowAgentRowView` per agent. |

`WorkflowAgentRowView` fields: `agentId`, `label`, `type`, `attempt` ("×2" or `null`), `model`, `state`, `stateLabel`, `metrics` ("235K tok · 56 tools · 4m 26s"), `runningSince` (a ticking clock is appended while set), `open`, and `detail` (`null` while closed).

`WorkflowAgentDetailView` has a `status` of `loading`, `error`, `empty` or `ready`, and when ready: `facts` (agent number, type, queue time, turns, attempts, tool errors), `tokens` (in, out, cache write, cache read with its help), `tags` (skills and MCP servers), `prompt`, `result`, `files` and `tools` (the histogram, with failures).

## States

- No phases yet - "No phases yet." on the left and "No agents yet." on the right.
- A phase that has not started - "Not started yet." on the right.
- A phase marker is a check when every known agent is done, moving `ActivityBars` while one runs, and the phase number otherwise (`partial`: some agents stopped without finishing; `pending`: none seen yet).
- An agent marker is a check (done), a cross (failed), moving `ActivityBars` (running) or a still dot (queued and stalled, which also carry a badge with the word). Only a running agent moves; a stalled one never does.
- An open row shows its detail in a sunken well: a skeleton while it loads, an error with an optional retry, "No detail available" or the detail.

## Usage

```tsx
import { WorkflowPhasePanes } from '@/components/design-system/organisms/WorkflowPhasePanes/WorkflowPhasePanes';
```

Under a run header, edge to edge in a card without padding:

```tsx
<Card padding="none" className="overflow-hidden">
  {runHeader}
  <WorkflowPhasePanes view={run.panes} onSelectPhase={onSelectPhase} onToggleAgent={onToggleAgent} />
</Card>
```

With a retry for failed details:

```tsx
<WorkflowPhasePanes view={run.panes} onSelectPhase={onSelectPhase} onToggleAgent={onToggleAgent} onRetryAgent={onRetryAgent} />
```

## a11y

- Phases are buttons with `aria-pressed`; each also reads its state ("Done", "Running", "Not finished", "Not started").
- Agent rows are buttons with `aria-expanded`, pointing at their detail with `aria-controls` while open.
- A marker is never colour or motion alone: check, cross and bars are shapes with a hidden label, and dots carry a hidden label plus, for queued and stalled, a visible badge.
- The prompt and the result scroll inside the detail and are focusable, so they can be scrolled from the keyboard.
- Each tool bar is a `role="progressbar"` named with the tool, its call count and its failures.

## Private parts

- `WorkflowPhaseItem` - one phase button in the left pane.
- `WorkflowAgentRow` - one agent row in the right pane, with its detail when open.
- `WorkflowAgentMarker` - the state marker at the start of an agent row.
- `WorkflowAgentDetail` - the expanded detail of one agent.
- `WorkflowFact` - one labelled value in the detail.
- `WorkflowToolBar` - one row of the tool histogram.

## Notes

- Layout of an agent row: the label takes the free width and truncates with an ellipsis (full text in `title`); the model chip, the attempt badge, the metrics and the chevron never shrink or wrap, so the metrics stay fully visible at every width.
- The agent type is shown inline from `xl` up, and always in the row's `title` and in the detail.
- The left pane is 232px from `lg`, 184px from `md`, and sits above the agents below `md`.
- Below `sm` an agent row takes two lines: the marker, the label and the chevron, then the badges, the chip and the metrics, so nothing is clipped on a phone.
- Under `prefers-reduced-motion` the bars of a running phase or agent stand still.
- Fully controlled: which phase is selected and which rows are open come from the view. It holds no state, fetches nothing and has no timer of its own; the ticking clock is `ElapsedTime`.
