# ActivityBars

**Level:** Atom
**Purpose:** Tiny three-bar equalizer that moves while something is running, drawn in the current text colour.

## When to use

- Beside the word that names a running state, or inside its `Badge`: "Running", "Delegating".
- In the status position of a row, in place of a dot, for the rows that are running right now.

## When NOT to use

- A state that is waiting, queued, stalled or finished - use a still `StatusDot` or an icon.
- A connection or "live data" indicator - use `LiveStatus`.
- As the only sign of a state - it is decorative, so pair it with a visible or visually hidden word.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `className` | `string` | - | Extra classes merged onto the glyph: the colour (`text-success`) and, in a baseline-aligned row, `self-center`. |

## Usage

```tsx
import { ActivityBars } from '@/components/design-system/atoms/ActivityBars/ActivityBars';
```

Beside a word:

```tsx
<span className="inline-flex items-center gap-1.5 text-small text-fg-muted">
  <ActivityBars className="text-success" />
  Running
</span>
```

Inside a badge, taking the badge's text colour:

```tsx
<Badge tone="success">
  <ActivityBars />
  Delegating
</Badge>
```

In place of a status dot, with the state for screen readers:

```tsx
<span className="flex w-3 flex-none items-center justify-center text-success">
  <ActivityBars />
  <span className="sr-only">Running</span>
</span>
```

## a11y

- `aria-hidden`: the glyph carries no name. The word next to it, or an `sr-only` span, states the status.
- Under `prefers-reduced-motion` the bars stop at three fixed heights, so the glyph is still there but does not move.

## Notes

- 12px square: three 2px bars that scale from the bottom on `animate-equalizer` (1s), staggered by 0, 150 and 300ms. Transform only, so it never touches layout.
- The colour is `currentColor`; set it on the glyph or on its parent.
- Keep it mounted for as long as the state lasts; remounting restarts the bars.
