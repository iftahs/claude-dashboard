# SweepBar

**Level:** Atom
**Purpose:** Thin indeterminate progress line whose segment travels left to right while something is running.

## When to use

- Along the edge of a card or a row for work in flight with no known end: a running agent, a live workflow.
- Only while the thing is running. Unmount it when the work waits, stalls or finishes.

## When NOT to use

- A known share of a total - use `ProgressBar`.
- Content that is still loading - use `Skeleton`.
- As the only sign of a state - keep the word or the badge that names it.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `tone` | `'accent' \| 'success' \| 'info' \| 'neutral'` | `'accent'` | Colour of the travelling segment. `neutral` is `fg-subtle`. |
| `label` | `string` | `'Running'` | Accessible name, set as `aria-label`. |
| `className` | `string` | - | Extra classes merged onto the track, for position and for the track colour. |

## Variants

- `tone`: `accent`, `success`, `info`, `neutral`.
- 2px tall, fully rounded, full width, on a `line` track.

## Usage

```tsx
import { SweepBar } from '@/components/design-system/atoms/SweepBar/SweepBar';
```

In the flow, under a title:

```tsx
<SweepBar tone="success" label="Workflow running" />
```

Pinned to the bottom edge of a `relative` well, with no track, so the well keeps its size when the bar comes and goes:

```tsx
<li className="relative rounded-control border border-line bg-surface-sunken px-3 py-2.5">
  {content}
  {running ? <SweepBar tone="success" className="absolute inset-x-1.5 bottom-0 w-auto bg-transparent" /> : null}
</li>
```

## a11y

- `role="progressbar"` with an `aria-label` and no `aria-valuenow`, which is how an indeterminate bar is announced.
- Under `prefers-reduced-motion` the segment stops and becomes a still, faint line across the whole track, so the bar still reads as "in progress" without moving.

## Notes

- The segment is 40% of the track with soft ends and runs on `animate-sweep` (1.6s, transform only), so it never touches layout.
- Render it at the same place in the tree for as long as the work runs; remounting it restarts the sweep.
- Inset it from rounded corners (`inset-x-1.5` on a `rounded-control` well) instead of clipping the parent, which would also clip a `StatusDot` ping.
