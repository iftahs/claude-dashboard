# SegmentedControl

**Level:** Atom
**Purpose:** Row of two to five always-visible options on a neutral track, one of which is selected.

## When to use

- Switching the scope of what is on screen: platform (Claude, Codex, Both), surface, a time range (`7d`, `30d`, `90d`).
- `sm` inside card headers and beside other small controls.

## When NOT to use

- Six or more options, or long labels - use `Select`.
- Switching between views that each have their own content - use `Tabs`.
- A single on/off setting - use a checkbox or a switch.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `options` | `readonly { value: T; label: string }[]` | required | The segments, in display order. Each `value` must be unique. |
| `value` | `T` | required | The selected option's `value`. |
| `onChange` | `(value: T) => void` | required | Called with the clicked option's `value`. Not called for the segment that is already selected. |
| `ariaLabel` | `string` | required | Accessible name of the group, for example "Platform". |
| `size` | `'md' \| 'sm'` | `'md'` | 32px or 28px tall overall. |
| `className` | `string` | - | Extra classes merged onto the track. |

`T` is inferred from `options` and defaults to `string`, so a union such as `'claude' | 'codex' | 'both'` flows through to `onChange`.

## Variants

- `size`: `md` (32px track, 26px segments), `sm` (28px track, 22px segments).
- Selected segment: `surface-raised` fill outlined in `line-strong`, `fg` text.
- Other segments: transparent, `fg-muted` text that turns `fg` on hover.
- The track is `surface-sunken` with a `line` border. It never takes the accent colour.

## Usage

```tsx
import { SegmentedControl } from '@/components/design-system/atoms/SegmentedControl/SegmentedControl';
```

Platform switcher:

```tsx
<SegmentedControl
  ariaLabel="Platform"
  value={platform}
  onChange={onPlatformChange}
  options={[
    { value: 'claude', label: 'Claude' },
    { value: 'codex', label: 'Codex' },
    { value: 'both', label: 'Both' },
  ]}
/>
```

Small range picker in a card header:

```tsx
<SegmentedControl ariaLabel="Range" size="sm" value={range} onChange={onRangeChange} options={rangeOptions} />
```

## a11y

- The track is a `role="group"` named by `ariaLabel`; each segment is a native `<button>` with `aria-pressed`.
- Every segment is in the tab order and is activated with Enter or Space. Each shows the 2px focus ring.
- The selected state is carried by `aria-pressed`, the fill and the outline, not by colour alone.

## Notes

- Controlled only: the consumer owns `value`.
- Never wraps and never shrinks; keep labels to one or two short words.

## Motion

- The selected fill is one thumb that slides and resizes between options (180ms). It is measured from the selected option, and again whenever an option or the track resizes.
- It is placed before the first paint, so it never slides in from the edge. Until it has been measured, or while the control is hidden, the selected option draws its own fill.
- Option labels ease their colour over 120ms. The thumb is `aria-hidden` and sits before the options, whose order and `aria-pressed` are unchanged.
- Under `prefers-reduced-motion` the global rule makes this instant.
