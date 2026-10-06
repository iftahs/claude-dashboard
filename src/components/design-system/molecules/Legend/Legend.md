# Legend

**Level:** Molecule
**Purpose:** Wrapping row of chart legend entries, each a colour swatch with the series name and an optional value.

## When to use

- Above or below any chart with two or more series - a legend is required there.
- With `value` on each item when the legend also reports the series total or share.

## When NOT to use

- A single legend entry inside other text - use `LegendDot`.
- Tagging rows with a model - use `ModelChip`.
- A status list - use `StatusDot` with text, or `Badge`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `items` | `readonly LegendItem[]` | required | The entries, in the order the series are drawn. Renders nothing when empty. |
| `ariaLabel` | `string` | `'Legend'` | Accessible name of the list. Name the chart when a page has several: "Tokens by model". |
| `className` | `string` | - | Extra classes merged onto the list, for example `justify-end`. |

`LegendItem`:

| Field | Type | Default | Description |
|---|---|---|---|
| `label` | `string` | required | The series name. |
| `color` | `string` | required | Any CSS colour for the swatch: the string returned by `modelColor()`, `tagColor()` or a `PLATFORM_COLORS` entry. |
| `value` | `ReactNode` | - | Shown after the name in monospace `fg`. |
| `shape` | `'square' \| 'round'` | `'square'` | Square for bars and areas, round for lines and points. |
| `key` | `string` | `label` | React key, needed only when two entries share a label. |

## Usage

```tsx
import { Legend } from '@/components/design-system/molecules/Legend/Legend';
```

Models of a stacked bar chart:

```tsx
<Legend
  ariaLabel="Tokens by model"
  items={[
    { label: 'opus 5.5', color: modelColor('claude-opus-5-5'), value: '812K' },
    { label: 'sonnet 5.5', color: modelColor('claude-sonnet-5-5'), value: '431K' },
  ]}
/>
```

Two line series:

```tsx
<Legend items={[{ label: 'Claude', color: PLATFORM_COLORS.claude, shape: 'round' }, { label: 'Codex', color: PLATFORM_COLORS.codex, shape: 'round' }]} />
```

## a11y

- A `<ul>` named by `ariaLabel`, one `<li>` per series.
- Each swatch is decorative; the name is text, so colour never identifies a series alone.

## Notes

- Entries are 16px apart and wrap onto more lines with 4px between them; an entry itself never wraps.
- `color` is applied through an inline style, so pass a token value, not a raw hex.

## Exports

- `LegendItem` from `types.ts`, for the hook or view builder that builds `items`.
