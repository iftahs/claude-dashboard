# SessionUsagePanel

**Level:** Organism
**Purpose:** Card that shows what one session cost and where it went: optional plan limits on top, the session's facts, a per-model token and cost table, what is contributing, and a rule-based tip.

## When to use

- The Sessions page, once, in the sessions view above the search: the plan limits plus the newest session, with a picker over the ten most recent.
- Inside `SessionDetail`, so any session can be inspected (without the limits block and the picker).

## When NOT to use

- A list of sessions - use `SessionTable`.
- The live 5-hour or weekly window itself - use `LimitGauge` and `PlanLimitsCard`.
- Cost over time or by project - those are charts and `ProjectBreakdown`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `SessionUsageView` | required | The card's view model from `buildSessionUsage()` in `@/lib/views/session-usage`. |
| `onSessionChange` | `(sessionId: string) => void` | - | Called by the session picker. The picker is drawn only when this is passed and the view has one. |
| `as` | `'h2' \| 'h3'` | `'h2'` | Heading level of the card title; `h3` when it sits under another heading, as in the dialog. |
| `className` | `string` | - | Extra classes merged onto the card. |

`SessionUsageView` fields:

| Field | Type | Description |
|---|---|---|
| `title`, `help` | `string` | The card header: "Session usage". |
| `description` | `string \| null` | The session's title and project, on one line. |
| `state` | `SectionState \| null` | Loading (bars), error, or empty (no session, or no priced request); `null` once there is data. |
| `picker` | `{ label, value, options } \| null` | The ten most recent sessions, each labelled by title and project. |
| `limits` | `SessionUsageLimitView[]` | The plan's live windows (`key`, `label`, `value`, `percent`, `tone`, `note`), built from the shared live limits of the session's platform. Empty hides the block. |
| `facts` | `SessionUsageFactView[]` | Only what the log has: cost, active time, lines (`changes` carries the added and removed halves), web searches, cache hit. |
| `shares` | `SessionUsageShareView[]` | One legend entry per model with its share of the cost; drawn when there are two or more. |
| `models` | `SessionUsageModelView[]` | One table row per model: input, output, cache read, cache write, cost. |
| `contributors` | `SessionUsageContributorView[]` | Subagents, skills, MCP servers and plugins by share of the cost. Hidden when empty. |
| `tip` | `string \| null` | From `sessionUsageTip()`; null when nothing stands out. |
| `partialNote` | `string \| null` | Set when the transcript was over the 64 MB cap. |

## States

- `loading` - the header (picker included) and bar skeletons.
- `error` - the header and what failed.
- `empty` - the header and a sentence: no sessions yet, or no priced request in this one.
- Ready - the blocks above, each hidden when it has nothing to show.

## Usage

```tsx
import { SessionUsagePanel } from '@/components/design-system/organisms/SessionUsagePanel/SessionUsagePanel';
```

On the Sessions page:

```tsx
<SessionUsagePanel view={page.recentUsage} onSessionChange={page.onRecentUsageChange} />
```

In the dialog:

```tsx
<SessionUsagePanel view={usage} as="h3" />
```

## a11y

- A named `<section>` with a real heading; each block has a `h3` group label.
- Limits are meters with their value as text next to the label, so the tone never carries the status alone.
- The breakdown is a native table with a hidden caption; the model is a chip with its name.
- Added and removed lines carry a plus and a minus sign as well as their colours.
- The session picker is a `Select` named "Session shown".

## Notes

- Presentational: polling, the choice of session and the limits come from the `useSessionUsageCard` hook; the tip rules are the pure `sessionUsageTip()` in `@/lib/views/session-usage`.
- Costs are estimates priced from the local log at list API prices. The tip wording is the same on every platform.
- The tip rules, first match wins: subagents drive 20% or more of the cost; under half of the input came from the cache; the costliest model, Fable or Opus, took 70% or more.
- A session whose transcript is over the cap keeps its cost and tokens, but its active time, lines and prompts are incomplete, so the card says so.
- The breakdown scrolls sideways inside its frame below 520px; the page never does.
