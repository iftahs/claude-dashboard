# SourcesSplitChart

**Level:** Organism
**Purpose:** Card that splits the range's effective tokens between surfaces, or between Codex thread kinds, as one segmented bar over a row per part with its tokens, share and estimated cost.

## When to use

- The Trends page when the selection covers more than one surface: Claude Code and Cowork, all three under Both, or threads and guardian reviews under Codex.

## When NOT to use

- A single surface - there is nothing to split, so the page leaves the card out.
- A split over time - use a chart.
- A share against a limit - use `MeterRow`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `SourcesSplitView` | required | Built by `buildSourcesSplit()` in `@/lib/views/trends`: title, description, help and one row per part with its colour, bar width, tokens, share and estimated cost. |
| `className` | `string` | - | Extra classes merged onto the card. |

## Variants

- One look: a 12px bar with a 2px gap between segments, then rows divided by hairlines: swatch, name, tokens, share and estimated cost.
- A part with no cost (the unpriced guardian model) shows a dash in the cost column.

## Usage

```tsx
import { SourcesSplitChart } from '@/components/design-system/organisms/SourcesSplitChart/SourcesSplitChart';
```

```tsx
{view.sources ? <SourcesSplitChart view={view.sources} /> : null}
```

## a11y

- The bar is an image whose name lists every part with its share; the rows repeat the same parts as text, so colour never identifies one alone.

## Notes

- Memoised on `view`: build it in a `useMemo` in the page hook.
- Surface colours come from `SURFACE_COLOR` in `@/lib/platform`, the same mapping the weekly breakdown on Live usage draws with.
- A part with no tokens in the range is dropped by the builder, and the card is not rendered when no part is left.
