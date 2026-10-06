# SubagentStatsPanel

**Level:** Organism
**Purpose:** Card that counts the window's subagent spawns and Codex guardian reviews, then breaks them down by subagent type and by model.

## When to use

- The Tools view of the Insights page, beside `CommandUsage`.

## When NOT to use

- Agents running right now - that is the Agents page (`AgentActivity`).
- The delegation or auto-review rate - that is a tile in `InsightKpis`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `SubagentStatsPanelView` | required | The card's view model, built by `buildSubagentStats()` in `@/lib/views/insights`. |
| `className` | `string` | - | Extra classes merged onto the card. |

`SubagentStatsPanelView` fields:

| Field | Type | Description |
|---|---|---|
| `title`, `description`, `help` | `string` | The card header, worded for the platform on screen. |
| `state` | `SectionState \| null` | Loading or error; null once the data is in. |
| `ai` | `SectionAi \| null` | The AI explanation affordance. |
| `facts` | `{ key, label, value, tone }[]` | Claude: spawns and the average per delegating session. Codex: reviews, denied, average per reviewed thread, other subagents. Both: spawns and reviews. |
| `types` | `{ key, label, count }[]` | Spawns per subagent type, most first. |
| `models` | `{ key, model, count }[]` | Spawns per model, most first. |
| `emptyNote` | `string \| null` | Set when nothing was spawned or reviewed. |

## States

- `loading` - meter skeletons. `error` - the request failed with nothing earlier to show.
- Ready - the facts, then the two breakdowns under hairlines. With nothing spawned, the facts read zero and one line says so.

## Usage

```tsx
import { SubagentStatsPanel } from '@/components/design-system/organisms/SubagentStatsPanel/SubagentStatsPanel';
```

```tsx
<SplitLayout>
  <CommandUsage view={view.commands} />
  <SubagentStatsPanel view={view.subagents} />
</SplitLayout>
```

## a11y

- The card is a region named by its title. Both breakdowns are named lists; each count is text beside its type or model.
- A model is named in its chip; the chip's dot only repeats the model's fixed colour.

## Notes

- A guardian review is a safety check on an action, not delegated work, so spawns and reviews are counted apart and never blended.
