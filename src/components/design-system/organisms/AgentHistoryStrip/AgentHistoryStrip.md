# AgentHistoryStrip

**Level:** Organism
**Purpose:** Card that sums up one platform's subagent use over a period: how many were spawned, how many per session that delegated, the share of sessions that delegated, and which types did the work.

## When to use

- The Agents page, under the live view, so the page says something useful when no agent is running.
- One card per platform on screen; under Both, two cards side by side in a `SplitLayout`.

## When NOT to use

- The live agent tree - use `AgentActivity`.
- A full breakdown by model or over time - that belongs to the Insights page.
- A single number - use `StatTile`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `AgentHistoryView` | required | The card's view model, built by `buildAgentHistory()` in `@/lib/views/agents`. |
| `className` | `string` | - | Extra classes merged onto the card. |

`AgentHistoryView` fields:

| Field | Type | Description |
|---|---|---|
| `title`, `description`, `help` | `string` | The card title, the period ("Last 30 days") and the explanation behind the help button. |
| `state` | `SectionState \| null` | Loading, error or empty state; `null` when there are spawns to show. |
| `stats` | `AgentHistoryStatView[]` | Three facts: `label`, `value` and a `sub` line that says what the number is of. |
| `types` | `AgentHistoryTypeView[]` | The busiest subagent types: `label`, `count` and `percent`, its share of all spawns. |
| `moreTypes` | `string \| null` | How many types did not fit ("2 more types"). |
| `stacked` | `boolean` | The facts sit above the types instead of beside them, for a half-width slot. |

## States

- `loading` - the title and three meter-row skeletons.
- `error` - the title and "Could not load subagent history".
- `empty` - the title, "No subagents spawned in the last 30 days" and what makes one appear.
- Ready - the three facts as rows with a large value, then one small meter per type.

## Usage

```tsx
import { AgentHistoryStrip } from '@/components/design-system/organisms/AgentHistoryStrip/AgentHistoryStrip';
```

One platform:

```tsx
<AgentHistoryStrip view={claudeHistory} />
```

Both platforms side by side (each view has `stacked` set):

```tsx
<SplitLayout>
  {history.map((view) => (
    <AgentHistoryStrip key={view.platform} view={view} />
  ))}
</SplitLayout>
```

## a11y

- The card is a `<section>` labelled by its title; the facts are a description list, each label followed by its context line and its value.
- Each type meter is a `role="progressbar"` named by the type, with the count beside it as text.

## Private parts

- `AgentHistoryStat` - one fact: a label with its context line and a large value.

## Notes

- From `md` up the facts and the types sit in two columns, unless `stacked`. Two cards in one `SplitLayout` row stretch to the same height, with the content at the top.
- The type meters use the `neutral` tone on both platforms: they show a share, not a status.
- Labels and context lines truncate with their full text in `title`; values never wrap.
- Presentational: no hooks, no fetching.
