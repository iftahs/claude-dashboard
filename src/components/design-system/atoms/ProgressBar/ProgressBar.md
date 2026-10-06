# ProgressBar

**Level:** Atom
**Purpose:** Horizontal meter that fills a rounded track to a percentage in a status tone.

## When to use

- Limit meters, budget against a cap, a share of a total.
- Limit meters pick the tone from the value: `accent` below 70%, `warning` from 70%, `danger` from 90% or when the provider says the limit is reached. The consumer computes that and passes `tone`.

## When NOT to use

- Indeterminate loading - use `Skeleton`.
- Comparing several series over time - use a chart.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `value` | `number` | required | Percentage filled, 0 to 100. Clamped; a non-finite value draws 0. |
| `tone` | `'accent' \| 'warning' \| 'danger' \| 'success' \| 'neutral' \| 'codex'` | `'accent'` | Fill colour. `codex` is the Codex platform colour. |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Track height: 4px, 6px or 8px. |
| `label` | `string` | - | Accessible name, set as `aria-label`. |
| `className` | `string` | - | Extra classes merged onto the track. |

## Variants

- `tone`: `accent`, `warning`, `danger`, `success`, `neutral` (`fg-subtle`), `codex` (`platform-codex`).
- `size`: `sm`, `md`, `lg`.
- The track is always `surface-hover` and fully rounded.

## Usage

```tsx
import { ProgressBar } from '@/components/design-system/atoms/ProgressBar/ProgressBar';
```

A limit meter:

```tsx
<ProgressBar value={83} tone="warning" label="Weekly limit" />
```

Thin, Codex series:

```tsx
<ProgressBar value={codexShare} tone="codex" size="sm" label="Codex share of tokens" />
```

## a11y

- `role="progressbar"` with `aria-valuenow` (rounded), `aria-valuemin="0"` and `aria-valuemax="100"`.
- Pass `label` unless the bar sits next to visible text that already states the name and the value; the tone alone never carries the status.

## Notes

- Fills the width of its container.

## Motion

- The fill grows from zero 100ms after mount and glides to a new `value` (320ms). It is a full-width bar slid into the track with `transform`, so nothing reflows and its cap stays round.
- `aria-valuenow` always reports the real value, also while the fill is still growing.
- The first growth is started by a timer, not a CSS animation, so a list that re-orders its rows never replays it.
- Reduced motion: the fill is at its value from the first paint and jumps to a new one.
