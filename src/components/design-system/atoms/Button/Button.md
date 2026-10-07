# Button

**Level:** Atom
**Purpose:** Triggers an action with a text label, optionally led by an icon passed as a child.

## When to use

- Any labelled action: export, retry, save, open details.
- One `primary` per view region; everything else is `secondary`, `ghost` or `danger`.

## When NOT to use

- Icon-only actions - use `IconButton`.
- Navigating to another page - render a link.
- Picking one of several options - use a segmented control or `Select`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `variant` | `'primary' \| 'secondary' \| 'ghost' \| 'danger'` | `'secondary'` | Visual emphasis. |
| `size` | `'md' \| 'sm'` | `'md'` | 32px or 28px tall. Use `sm` inside card headers. |
| `type` | `'button' \| 'submit' \| 'reset'` | `'button'` | Native button type. |
| `className` | `string` | - | Extra classes merged onto the button. |

Spreads remaining `ButtonHTMLAttributes<HTMLButtonElement>` onto the `<button>` and forwards its ref.

## Variants

- `primary` - accent fill, the main action.
- `secondary` - surface fill with the control outline.
- `ghost` - no fill or border until hovered.
- `danger` - soft danger fill for destructive actions.
- `disabled` (native attribute) - grey fill, `fg-disabled` text, no hover, on every variant.

## Usage

```tsx
import { Button } from '@/components/design-system/atoms/Button/Button';
```

Primary action:

```tsx
<Button variant="primary" onClick={onExport}>Start export</Button>
```

Icon and label (children sit in a flex row with a 6px gap):

```tsx
<Button size="sm" onClick={onRetry}>
  {retryIcon}
  Try again
</Button>
```

## a11y

- Renders a native `<button>`: focusable, activated with Enter and Space.
- Shows the 2px focus ring on keyboard focus.
- Use the `disabled` attribute to disable; do not fake it with classes.
- An icon passed as a child must be decorative (`aria-hidden`); the label carries the name.

## Motion

- Hover and disabled colours ease over 120ms, and an enabled button scales to 98% while it is pressed. The focus ring is not transitioned, so it appears at once.
- Under `prefers-reduced-motion` the global rule makes this instant.
