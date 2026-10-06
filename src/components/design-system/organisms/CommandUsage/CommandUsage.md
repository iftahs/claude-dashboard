# CommandUsage

**Level:** Organism
**Purpose:** Card that ranks the slash commands you typed and the skills that ran, with a badge on the skill rows.

## When to use

- The Tools view of the Insights page, beside `SubagentStatsPanel`.

## When NOT to use

- Tool calls - use `ToolUsage`.
- The skills installed on this machine - that is the inventory on the Workspace page.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `CommandUsageView` | required | The card's view model, built by `buildCommandUsage()` in `@/lib/views/insights`. |
| `className` | `string` | - | Extra classes merged onto the card. |

`CommandUsageView` fields:

| Field | Type | Description |
|---|---|---|
| `title`, `description`, `help` | `string` | The card header. The description carries the totals: slash commands, skill sessions, unique names. |
| `state` | `SectionState \| null` | Loading, error or empty; null when there are commands to show. |
| `ai` | `SectionAi \| null` | The AI explanation affordance. |
| `rows` | `InsightRankedRow[]` | The top twelve, most used first. A skill row carries the `skill` badge. |

## States

- `loading` - meter skeletons. `error` - the request failed with nothing earlier to show.
- `empty` - nothing was recorded. Under Codex the text says it logs no slash commands or skill runs.
- Ready - up to twelve rows.

## Usage

```tsx
import { CommandUsage } from '@/components/design-system/organisms/CommandUsage/CommandUsage';
```

```tsx
<CommandUsage view={view.commands} />
```

## a11y

- The card is a region named by its title; the list is named "Slash commands and skills" and every bar is a `role="progressbar"` with its count as text.
- A skill is marked with the word "skill", not with a colour.

## Notes

- The two kinds count different things: a slash command counts every time it was typed, a skill counts the sessions that ran it.
