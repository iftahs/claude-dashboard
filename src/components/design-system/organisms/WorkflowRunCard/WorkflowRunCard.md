# WorkflowRunCard

**Level:** Organism
**Purpose:** Card for one running workflow: a header with its status, name, summary, agent progress and running time, over its phases and the agents of the selected phase.

## When to use

- The Live group of the Workflows page, one card per running workflow.

## When NOT to use

- A finished run in the recent list - use `WorkflowRunRow`, which starts collapsed.
- A one-line mention of a running workflow - `RunningNow` lists those on the Overview page.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `WorkflowLiveRunView` | required | The card's view model, built by `buildWorkflowRuns()` in `@/lib/views/workflows`. |
| `onSelectPhase` | `(runId, index) => void` | required | A phase was clicked. |
| `onToggleAgent` | `(runId, agentId) => void` | required | An agent row was clicked. |
| `onRetryAgent` | `(runId, agentId) => void` | - | Adds a retry button to an agent detail that failed to load. |
| `className` | `string` | - | Extra classes merged onto the card. |

`WorkflowLiveRunView` fields:

| Field | Type | Description |
|---|---|---|
| `runId`, `name`, `summary` | `string` | The run. `summary` is empty when it only repeats the name. |
| `live` | `boolean` | Shows the pulsing dot, the sweep along the header and a ticking clock from `startedAt`; otherwise a neutral dot and the fixed `duration`. |
| `progress` | `string` | "8 of 9 agents". |
| `startedAt`, `duration` | `number`, `string` | The start in epoch milliseconds, and the formatted duration for a run that is no longer live. |
| `panes` | `WorkflowPanesView` | Passed to `WorkflowPhasePanes`. |

## States

- Live - a pulsing success dot (read as "Running"), "8 of 9 agents · 15m 21s" with the time ticking, and a `SweepBar` travelling along the header's bottom hairline.
- Not live - a neutral dot and the fixed duration, with nothing moving.
- The panes carry their own states: no phases yet, a phase that has not started, an agent detail loading or failing (see `WorkflowPhasePanes`).

## Usage

```tsx
import { WorkflowRunCard } from '@/components/design-system/organisms/WorkflowRunCard/WorkflowRunCard';
```

In the Live group:

```tsx
<SectionStackLayout title={<GroupLabel note="1 running">Live</GroupLabel>}>
  {live.map((run) => (
    <WorkflowRunCard key={run.runId} view={run} onSelectPhase={onSelectPhase} onToggleAgent={onToggleAgent} />
  ))}
</SectionStackLayout>
```

With a retry for agent details:

```tsx
<WorkflowRunCard view={run} onSelectPhase={onSelectPhase} onToggleAgent={onToggleAgent} onRetryAgent={onRetryAgent} />
```

## a11y

- The card is a `<section>` labelled by the run name, which is an `<h3>`.
- The status dot carries a hidden "Running" or "Not running", so the state does not rest on colour.
- The running time is plain ticking text, not a live region.
- The sweep is an indeterminate `role="progressbar"` named "Workflow running".

## Notes

- A custom card instead of `Section`: the approved layout puts the status, the name, the summary and the progress on one header line and runs the two panes edge to edge under it.
- The name keeps up to 45% of the header and truncates; the summary takes the rest and truncates (full text in `title`); the progress never wraps. Below `sm` the summary is hidden.
- The sweep is indeterminate on purpose: the agent total of a live run is only the agents started so far, so a fill would jump backwards whenever a phase spawns more.
- The sweep sits on the header's border, absolutely positioned, so the header is the same height live or not. Under `prefers-reduced-motion` it is a still, faint line and the dot stops pinging.
- Presentational and fully controlled: no state, no fetching.
