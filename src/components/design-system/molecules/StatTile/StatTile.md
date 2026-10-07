# StatTile

**Level:** Molecule
**Purpose:** Card that shows one number under an uppercase label, with an optional line of context and a help popover.

## When to use

- A row of headline numbers at the top of a page: Runs, Success rate, Est. cost.
- `tone` when the number itself is good or bad news, such as a success rate or a count of failures.
- `sm` for a dense strip of secondary numbers.

## When NOT to use

- A number with a trend or a chart beside it - compose a card for it in an organism.
- A value against a limit - use `MeterRow`.
- Inside another card - a tile is a card; use a plain label and value row there.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `label` | `string` | required | What the number is, in sentence case. Uppercased by the style; truncates with an ellipsis. |
| `value` | `ReactNode` | required | The number, already formatted: `69`, `97%`, `~$1,332`. Never wraps. |
| `sub` | `ReactNode` | - | One line of context under the value. Truncates with an ellipsis; a string keeps its full text in `title`. |
| `tone` | `'default' \| 'success' \| 'warning' \| 'danger' \| 'accent'` | `'default'` | Colour of the value. |
| `help` | `ReactNode` | - | Explanation shown in an `InfoTip` beside the label. |
| `size` | `'md' \| 'sm'` | `'md'` | `md`: 16px padding, `text-metric` value. `sm`: 12px padding, `text-heading` value. |
| `className` | `string` | - | Extra classes merged onto the card. |

## Variants

- `tone`: `default` (`fg`), `success`, `warning`, `danger`, `accent` (the tone's `-fg` text colour). Only the value takes the tone.
- `size`: `md`, `sm`.
- Label is `text-label` in `fg-subtle`; sub is `text-caption` in `fg-muted`.

## Usage

```tsx
import { StatTile } from '@/components/design-system/molecules/StatTile/StatTile';
```

A row of tiles:

```tsx
<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
  <StatTile label="Runs" value="69" />
  <StatTile label="Success rate" value="97%" sub="67 completed, 2 failed" tone="success" />
  <StatTile label="Est. cost" value="~$1,332" sub="Blended estimate" help="Estimated equivalent API cost, not a bill." />
</div>
```

Dense secondary number:

```tsx
<StatTile size="sm" label="Tool calls" value="33K" />
```

## a11y

- Renders a plain `<div>` card: the label, the value and the sub line are read in that order.
- The tone only colours the value, so the label or the sub line must say what makes it good or bad ("2 failed").
- The help button is named "About <label>" and opens on click, Enter or Space.
- The label, and a `sub` passed as a string, carry their full text in `title`, for when they are truncated.

## Notes

- Tiles sit 16px apart (`gap-4`). Give the grid `min-w-0` columns (`grid-cols-*` does) so labels can truncate.
- The value never wraps or truncates; keep it compact (`1.3M`, not `1,300,000`).

## Motion

- A string `value` that is one number with an optional sign, currency or unit (`42%`, `~$12.34`, `1.2M`) counts up from zero once, over 600ms, the first time the tile holds such a value.
- Only the digits move: the unit and the decimals stay as formatted, the final value holds the width, and it stays the accessible text while the digits count.
- Every later value is shown exactly as given, so polling never replays the count. Any other `value` (a node, a duration, a name) is never counted.
- Reduced motion or a hidden tab: no count, the value is shown at once.
