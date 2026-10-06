# ToolUsage

**Level:** Organism
**Purpose:** Card that ranks the tools the agent called in the window, each with a bar against the most-used tool and its call count.

## When to use

- The Tools view of the Insights page, beside `McpBreakdown`.

## When NOT to use

- Tools that failed - use `ErrorBreakdown`. Tools that were declined - use `RejectionsPanel`.
- A model statistic - tool calls are not one; they do not belong on the Models page.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `ToolUsageView` | required | The card's view model, built by `buildToolUsage()` in `@/lib/views/insights`. |
| `className` | `string` | - | Extra classes merged onto the card. |

`ToolUsageView` fields:

| Field | Type | Description |
|---|---|---|
| `title`, `description`, `help` | `string` | The card header. The description carries the total number of calls. |
| `state` | `SectionState \| null` | Loading, error or empty; null when there are calls to show. |
| `ai` | `SectionAi \| null` | The AI explanation affordance. |
| `rows` | `InsightRankedRow[]` | The top tools, most calls first, MCP tools named as server and tool. |

## States

- `loading` - meter skeletons. `error` - the request failed with nothing earlier to show. `empty` - no tool ran in the window.
- Ready - up to fourteen rows.

## Usage

```tsx
import { ToolUsage } from '@/components/design-system/organisms/ToolUsage/ToolUsage';
```

```tsx
<SplitLayout>
  <ToolUsage view={view.tools} />
  <McpBreakdown view={view.mcp} />
</SplitLayout>
```

## a11y

- The card is a region named by its title; the list is named "Calls by tool" and every bar is a `role="progressbar"` with its count as text.
- A truncated tool name keeps its full id in `title`.

## Notes

- Counts are one per tool call, from the insights builders, not from usage events.
