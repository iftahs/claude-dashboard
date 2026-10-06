# RankedMeterList

**Level:** Molecule
**Purpose:** Ranked list where every row is a name, a thin bar drawn against the largest row and its value in monospace, with the columns lined up down the list.

## When to use

- Comparing the sizes of named things in one card: calls by tool, edits by language, failures by category, cost per model.
- With `secondary` for a second, quieter number per row: the total the value is out of, a rate, a count of reads.
- With `color` when a row stands for a chart series, so the swatch carries the series colour and the bar stays neutral.

## When NOT to use

- A value against a limit or a cap - use `MeterRow`, whose bar takes the limit tones.
- A long label with several values on its own line - use `MeterRow`.
- Records with more than two numbers per row - use `Table`.
- A trend over time - use a chart.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `rows` | `readonly RankedMeterRow[]` | required | The rows, already sorted and clipped. Renders nothing when empty. |
| `ariaLabel` | `string` | required | Accessible name of the list: "Calls by tool". |
| `tone` | `'accent' \| 'warning' \| 'danger' \| 'success' \| 'neutral' \| 'codex'` | `'neutral'` | Bar colour of every row that does not set its own. |
| `labelWidth` | `'sm' \| 'md' \| 'lg'` | `'md'` | Cap of the name column: 96px, 144px or 208px. The column is as wide as its longest name, up to the cap. |
| `mono` | `boolean` | `false` | Names in monospace, for commands, tools and other identifiers. |
| `className` | `string` | - | Extra classes merged onto the list. |

`RankedMeterRow`:

| Field | Type | Default | Description |
|---|---|---|---|
| `label` | `string` | required | The name. Truncates with an ellipsis; also names the bar for screen readers. |
| `percent` | `number` | required | How full the bar is, 0 to 100, usually the row's share of the largest row. |
| `value` | `string` | required | The formatted number. Never wraps. |
| `key` | `string` | `label` | React key, needed when two rows share a label. |
| `title` | `string` | `label` | Full text shown on hover: the untruncated name, a path, a hint. |
| `detail` | `string` | - | Quieter text after the name, such as the project a file belongs to. |
| `badge` | `string` | - | A neutral `Badge` after the name that marks the kind of row: "skill". |
| `color` | `string` | - | Any CSS colour for an 8px swatch before the name, for example the string returned by `modelColor()`. |
| `tone` | bar tone | list `tone` | Bar colour of this row. |
| `valueTone` | `'default' \| 'muted' \| 'subtle' \| 'success' \| 'warning' \| 'danger'` | `'default'` | Colour of the value. |
| `secondary` | `string` | - | A second number in its own column. The column appears when any row has one. |
| `secondaryTone` | value tone | `'subtle'` | Colour of the second number. |

## Variants

- Bars are 4px tall on the `surface-hover` track. `neutral` is the default so the accent stays with limit meters.
- Names are `text-small` in `fg-muted`, or 12px monospace with `mono`.
- Values are 12px monospace, right aligned, each in a column as wide as its widest entry.

## Usage

```tsx
import { RankedMeterList } from '@/components/design-system/molecules/RankedMeterList/RankedMeterList';
```

Calls by tool:

```tsx
<RankedMeterList
  ariaLabel="Calls by tool"
  mono
  rows={[
    { label: 'Bash', percent: 100, value: '4.1K' },
    { label: 'Read', percent: 71, value: '2.9K' },
    { label: 'Edit', percent: 38, value: '1.6K' },
  ]}
/>
```

Failures by tool, with the rate in the second column:

```tsx
<RankedMeterList
  ariaLabel="Failures by tool"
  tone="danger"
  rows={[{ label: 'Bash', percent: 100, value: '42 / 4.1K', valueTone: 'muted', secondary: '1%', secondaryTone: 'muted' }]}
/>
```

Rows that stand for chart series:

```tsx
<RankedMeterList
  ariaLabel="Cost per 1M effective tokens"
  rows={models.map((model) => ({ label: model.label, color: model.color, percent: model.percent, value: model.value }))}
/>
```

## a11y

- A `<ul>` named by `ariaLabel`, one `<li>` per row. Each bar is a `role="progressbar"` named by its row, and the value is plain text beside it.
- Colour never carries a row's meaning alone: the swatch repeats a series the name already states, and a toned value needs a label, a heading or a note that says what the tone means.
- `title` is a pointer-only hint. Do not put information there that appears nowhere else.

## Notes

- The list is a grid and each row is a subgrid of it, so the name, bar and value columns line up down the list while every row stays a real list item.
- Rows are 8px apart. The list has no outer margin and fills the width of its container; the bar takes the width the other columns leave and never gets narrower than 40px.
- It does not sort or clip: pass the rows in the order and number to show.

## Exports

- `RankedMeterRow` from `types.ts`, for the organism that maps a view model onto rows.
