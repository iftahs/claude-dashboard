# Sparkline

**Level:** Atom
**Purpose:** Draws a tiny bar trend from a list of numbers, with no axes, labels or tooltip.

## When to use

- A glanceable trend next to a metric: the last seven days, the last few runs.
- `highlightLast` when the newest bar is the one the metric describes.

## When NOT to use

- Anything the reader must read values from - use a real chart with axes, a legend and a tooltip.
- More than about 30 points - the bars become too thin to read.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `values` | `number[]` | required | One bar per value, oldest first. Scaled to the largest value. |
| `height` | `number` | `36` | Height of the tallest bar, in pixels. |
| `highlightLast` | `boolean` | `false` | Draws the last bar in `accent`; the others stay `line-strong`. |
| `label` | `string` | - | Text alternative. When set, the sparkline is exposed as an image with this name. |
| `className` | `string` | - | Extra classes merged onto the root, usually a width. |

## Variants

- Bars: neutral (`line-strong`) or highlighted (`accent`, last bar only).

## Usage

```tsx
import { Sparkline } from '@/components/design-system/atoms/Sparkline/Sparkline';
```

Decorative, beside a metric that already states the number:

```tsx
<Sparkline values={dailyTokens} highlightLast className="w-32" />
```

Standing alone, with a text alternative:

```tsx
<Sparkline values={dailyCost} height={24} label="Est. cost per day, last 7 days, rising" />
```

## a11y

- Without `label` it is `aria-hidden`: the adjacent metric must carry the meaning.
- With `label` it gets `role="img"` and `aria-label`; write the trend in words.

## Notes

- Fills the width of its container; bars share it equally with a 4px gap.
- Bars are at least 3px tall, so zero, negative and non-finite values still show a stub. An all-zero series draws flat stubs.

## Motion

- The bars scale up from the baseline once, 100ms after mount (320ms, `transform` only). Later value changes are not animated.
- Reduced motion: the bars are at full height from the first paint.
