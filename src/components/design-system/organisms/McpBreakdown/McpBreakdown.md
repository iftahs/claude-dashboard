# McpBreakdown

**Level:** Organism
**Purpose:** Card that splits tool calls between the agent's built-in tools and tools from MCP servers, with a table of calls and errors per server.

## When to use

- The Tools view of the Insights page, beside `ToolUsage`.

## When NOT to use

- The MCP servers installed on this machine - that is the inventory on the Workspace page.
- Calls per tool - use `ToolUsage`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `McpBreakdownView` | required | The card's view model, built by `buildMcpBreakdown()` in `@/lib/views/insights`. |
| `className` | `string` | - | Extra classes merged onto the card. |

`McpBreakdownView` fields:

| Field | Type | Description |
|---|---|---|
| `title`, `description`, `help` | `string` | The card header. |
| `state` | `SectionState \| null` | Loading, error or empty; null when there are calls to show. |
| `ai` | `SectionAi \| null` | The AI explanation affordance. |
| `builtin`, `mcp` | `{ label, count, percent, share }` | The two sides of the split. |
| `explanation` | `string` | What "built-in" and "MCP" mean for the platform on screen, and what counts as an error. |
| `servers` | `{ server, calls, errors, failed }[]` | One row per MCP server. `errors` is a dash when none failed. |
| `emptyNote` | `string \| null` | Set when no MCP tool was called. |

## States

- `loading` - meter skeletons. `error` - the request failed and there is nothing earlier to show. `empty` - no tool ran in the window.
- Ready - the split bar with its legend, the explanation, then the per-server table, or a line saying no MCP tool was called.

## Usage

```tsx
import { McpBreakdown } from '@/components/design-system/organisms/McpBreakdown/McpBreakdown';
```

```tsx
<McpBreakdown view={view.mcp} />
```

## a11y

- The card is a region named by its title. The split bar is one `role="img"` whose name states both shares; the legend repeats them as text with the counts.
- The table has a hidden caption and column headers. An error count is in the danger colour under the "Errors" header, so the colour is not the only cue.

## Notes

- The two segments are a neutral and the info colour: this split is not a platform comparison, so it does not use the platform colours.
- A declined call never reached the server, so it is not an error here.
- The table sits in a bordered well inside the card and never scrolls the page.
