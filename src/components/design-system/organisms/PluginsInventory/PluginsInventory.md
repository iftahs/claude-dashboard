# PluginsInventory

**Level:** Organism
**Purpose:** Card that lists the integrations installed on this machine as groups of chips with a count each: MCP servers, plugins, marketplaces, skills, automations and hooks.

## When to use

- The Workspace page, once, for the platform or platforms on screen. Under Both the two inventories are merged and every chip names its platform.

## When NOT to use

- How often a tool or an MCP server was called - that is usage, shown on the Insights page.
- A platform's settings - use `ProfileCard`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `InventorySectionView` | required | The card's view model: the header fields built in the page hook plus the body from `buildInventory()` in `@/lib/views/workspace`. |
| `className` | `string` | - | Extra classes merged onto the card. |

`InventorySectionView` fields:

| Field | Type | Description |
|---|---|---|
| `title`, `description`, `help` | `string` | The card header. |
| `state` | `SectionState \| null` | Loading, error or empty state; `null` when there is something to list. |
| `ai` | `SectionAi \| null` | The AI explanation affordance from `sectionAi('plugins', data)`. |
| `defaults` | `InventoryItemView[]` | Chips above the groups: the default model and effort. |
| `groups` | `InventoryGroupView[]` | `key`, `title`, `count` and `items`, in display order. |

`InventoryItemView`: `key`, `label`, `meta` (quiet words after the label: a scope, a marketplace, "off", "bundled", the platform), `muted` (turned off or paused) and `title` (hover text).

## States

- `loading` - the header and a text skeleton.
- `error` - the header and what failed.
- `empty` - the header and what makes an integration appear.
- Ready - the default chips, then the groups in two columns from `lg` up. A group with no items reads "None".

## Usage

```tsx
import { PluginsInventory } from '@/components/design-system/organisms/PluginsInventory/PluginsInventory';
```

```tsx
<PluginsInventory view={inventory} />
```

## a11y

- The card is a named region through `Section`; its title is an `<h3>`.
- Each group is a `role="group"` named by its label; the count sits beside the label as text.
- A muted chip says why in words ("off") and in its `title`; the dashed outline only reinforces it.

## Private parts

- `InventoryGroup` - one labelled group with its count and its chips.
- `InventoryChip` - one integration as a chip with its quiet meta words.

## Notes

- A chip never wraps: a long name truncates inside the chip and keeps its full text in `title`.
- Presentational: grouping, counts and tags come from the view model.
