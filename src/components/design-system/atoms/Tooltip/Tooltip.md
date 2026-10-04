# Tooltip

**Level:** Atom
**Purpose:** Shows a short floating explanation when its trigger is hovered or focused.

## When to use

- Naming an icon-only button.
- The full text of a truncated name, or a short definition of a metric.

## When NOT to use

- Content the reader must be able to reach on touch, or that holds links or buttons - use a popover.
- Information needed to use the page - put it on the page.
- Chart hover read-outs - charts have their own tooltip.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `content` | `ReactNode` | required | The bubble's content. When empty (`null`, `undefined`, `false` or `''`) only the trigger renders. |
| `children` | `ReactElement` | required | The trigger: exactly one element that accepts a ref and spread props. |
| `side` | `'top' \| 'right' \| 'bottom' \| 'left'` | `'top'` | Preferred side; flips when there is no room. |
| `delay` | `number` | `300` | Milliseconds of hover before the bubble opens. |

## Usage

```tsx
import { Tooltip } from '@/components/design-system/atoms/Tooltip/Tooltip';
```

Explaining a term (the trigger is focusable):

```tsx
<Tooltip content="Cache reads are excluded from effective tokens. They do not count toward rate limits.">
  <button type="button">Effective tokens</button>
</Tooltip>
```

Below the trigger, no delay:

```tsx
<Tooltip content={fullName} side="bottom" delay={0}>
  <a href={href} className="truncate">{fullName}</a>
</Tooltip>
```

## a11y

- Built on Radix Tooltip: opens on hover and on keyboard focus, closes on Escape, and links the bubble to the trigger with `aria-describedby`.
- The trigger must be focusable (a button, a link, or an element with `tabIndex={0}`), or keyboard users never see the bubble.
- A tooltip is a description, not a name: an icon-only button still needs its own `aria-label`.

## Notes

- The bubble sits on `surface-raised` with `border-line` and `shadow-pop`, in `text-small`, at most 260px wide, in a portal at `z-50`.
- Each tooltip carries its own Radix `Provider`, so it works with no setup. Function components used as the trigger must forward their ref.
