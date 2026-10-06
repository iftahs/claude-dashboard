# LegendDot

**Level:** Atom
**Purpose:** One chart legend entry: a colour swatch, the series name and an optional value.

## When to use

- Naming a series in a chart legend or a chart tooltip.
- With `value` when the legend also reports the series total or share.

## When NOT to use

- A status - use `StatusDot` or `Badge`.
- Tagging a row with a model or project - use `Chip`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `color` | `string` | required | Any CSS colour for the 8px swatch, for example the string returned by `modelColor()`. |
| `shape` | `'square' \| 'round'` | `'square'` | Swatch shape: 2px corners for bars and areas, round for lines and points. |
| `children` | `ReactNode` | - | The series name. |
| `value` | `ReactNode` | - | Shown after the name in monospace `fg`. |
| `className` | `string` | - | Extra classes merged onto the entry. |

## Variants

- `shape`: `square`, `round`.

## Usage

```tsx
import { LegendDot } from '@/components/design-system/atoms/LegendDot/LegendDot';
```

A legend entry:

```tsx
<LegendDot color={modelColor(model)}>opus 5.5</LegendDot>
```

With a value, for a line series:

```tsx
<LegendDot color="rgb(var(--platform-codex))" shape="round" value="1.3M">Codex</LegendDot>
```

## a11y

- The swatch is `aria-hidden`; the name and value are plain text.
- Colour never identifies a series alone: always pass the name.

## Notes

- `text-caption` in `fg-muted`, 6px gap, never wraps.
- `color` is applied through an inline style, so pass a token value, not a raw hex.
- Lay several entries out with `flex flex-wrap gap-4` in the composing molecule.
