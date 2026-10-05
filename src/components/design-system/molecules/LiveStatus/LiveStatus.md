# LiveStatus

**Level:** Molecule
**Purpose:** Status dot and a caption that say whether the page is receiving live data, paused or failing.

## When to use

- The live indicator at the end of the topbar.
- Beside a card title when one data source has its own connection state.

## When NOT to use

- The status of a run or an agent - use `StatusDot` with a word, or a `Badge`.
- An error that needs explaining or a retry - use `ErrorState` or a `Toast`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `state` | `'live' \| 'paused' \| 'error'` | required | Which state to show. |
| `label` | `string` | `'Live'`, `'Paused'` or `'Offline'` | Replaces the default caption, for example "Updated 2m ago". |
| `className` | `string` | - | Extra classes merged onto the root. |
| `captionClassName` | `string` | - | Classes for the caption alone, for example `max-xl:sr-only` to keep only the dot where space is tight. |

## Variants

- `live`: pulsing `success` dot, `fg-muted` caption.
- `paused`: still `neutral` dot, `fg-muted` caption.
- `error`: still `danger` dot, `danger-fg` caption.
- 6px dot, 6px gap, `text-caption`.

## Usage

```tsx
import { LiveStatus } from '@/components/design-system/molecules/LiveStatus/LiveStatus';
```

Topbar indicator:

```tsx
<LiveStatus state={isLive ? 'live' : 'paused'} />
```

Failing, with its own wording:

```tsx
<LiveStatus state="error" label="Not updating" />
```

## a11y

- The caption is real text, so the state is never carried by the dot's colour or pulse alone; the dot is `aria-hidden`.
- It is not a live region, because the caption may change often. Announce a lost connection through a `Toast` or an `ErrorState` instead.
- The pulse is removed under `prefers-reduced-motion`.

## Notes

- Never wraps and never shrinks.
- The state comes from the polling hook; this component holds no timer.
