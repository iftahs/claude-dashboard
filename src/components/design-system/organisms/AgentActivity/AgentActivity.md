# AgentActivity

**Level:** Organism
**Purpose:** Card that shows one platform's agents working right now: each main session or thread with its state, its running subagents nested beneath it and the ones that just finished.

## When to use

- The Agents page, one card per platform on screen (Claude, Codex, or both stacked).
- Anywhere the full live agent tree is needed, with subagents attached to the session that spawned them.

## When NOT to use

- A compact "what is running" strip with a link to the full view - use `RunningNow`.
- Subagent totals over a period - use `AgentHistoryStrip`.
- Workflow runs with phases - use `WorkflowRunCard`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `AgentActivityView` | required | The card's view model, built by `buildAgentActivity()` in `@/lib/views/agents`. |
| `className` | `string` | - | Extra classes merged onto the card. |

`AgentActivityView` fields:

| Field | Type | Description |
|---|---|---|
| `title`, `help` | `string` | The card title and the explanation behind its help button. |
| `state` | `SectionState \| null` | Loading, error or empty state; `null` when there is activity to show. |
| `counts` | `AgentCountView[]` | Tallies above the list: `label`, `tone`, `live` for the pulsing dot, and `help`. Only counts above zero are passed. |
| `mainsLabel`, `subagentsLabel`, `orphansLabel` | `string` | Group headings in the platform's own nouns. |
| `mains` | `MainAgentView[]` | Main sessions or threads: `title`, `project`, `branch`, `model`, `lastActivity`, `effectiveTokens`, `state`, and their `running` and `completed` subagents. |
| `orphanRunning`, `orphanCompleted` | view arrays | Subagents whose parent session is not listed. |

## States

- `loading` - the title and a text skeleton.
- `error` - the title and what failed.
- `empty` - the title, "No agents running right now" and what makes one appear.
- Ready - the counts, then the main sessions, then the subagents without a listed parent.

A main session shows one of five states, always as a dot and a word:

| `state` | Dot | Badge |
|---|---|---|
| `waiting` | danger | "Waiting on you", with a danger border on the row |
| `delegating` | success, pulsing | "Delegating" |
| `running` | success, pulsing | "Running" |
| `yourTurn` | info | "Your turn" - soft, never an alert |
| `idle` | neutral | "Not active", with the title in the muted colour |

## Usage

```tsx
import { AgentActivity } from '@/components/design-system/organisms/AgentActivity/AgentActivity';
```

One platform:

```tsx
<AgentActivity view={claudeActivity} />
```

Both platforms, stacked:

```tsx
<SectionStackLayout title={<GroupLabel>Now</GroupLabel>}>
  {activity.map((view) => (
    <AgentActivity key={view.platform} view={view} />
  ))}
</SectionStackLayout>
```

## a11y

- The card is a `<section>` labelled by its title; main sessions, running subagents and finished subagents are lists.
- A state is never colour alone: every main session carries a badge with the state in words, a running subagent reads "running" beside its clock, and a finished one carries a check icon and a "Done" badge.
- The clocks are plain ticking text, not live regions; each carries a `title` that says what it measures.
- The help buttons beside the waiting and your-turn counts are `InfoTip`s named after the count.

## Private parts

- `AgentActivityCounts` - the row of tallies with their help buttons.
- `MainAgentCard` - one main session or thread, with its subagents nested under it.
- `SubagentGroup` - a labelled group of running subagents and finished ones.
- `RunningAgentCard` - one running subagent.
- `CompletedAgentRow` - one subagent that just finished.
- `AgentTokens` - an effective-token count that counts up when it changes.
- `AgentFlash` - the tint layer behind a row that fades in when the row makes progress.

## Notes

- Rows are `surface-sunken` wells, not cards, because they sit inside the section card.
- Entering and leaving rows fade and shift over 150ms through `framer-motion`; a row whose tokens or activity just rose is tinted `accent-soft` for under a second (150ms in, 500ms out). The tint is a separate layer that fades its opacity, so the row's own colours never animate and a theme switch stays instant. Both are switched off under `prefers-reduced-motion`.
- Titles, projects and descriptions truncate with their full text in `title`; badges, chips, token counts and clocks never wrap.
- A main session's clock is the time since its last activity ("active 12s ago"); a running subagent's clock is its running time.
- Presentational: `useCountUp` and `useFlashOnIncrease` are its only hooks. No fetching, no routing.
