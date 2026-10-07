# IconButton

**Level:** Atom
**Purpose:** Square button that shows only an icon and carries its name in a required label.

## When to use

- Compact actions whose icon is universally understood: refresh, close, collapse, switch theme.
- `ghost` in toolbars and card headers; `secondary` when the button stands alone and needs an outline.

## When NOT to use

- An action that needs words to be understood - use `Button`.
- A decorative icon that does nothing - render the icon alone.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `label` | `string` | required | Accessible name, set as `aria-label`. |
| `children` | `ReactNode` | - | The icon node, 16px. |
| `variant` | `'ghost' \| 'secondary'` | `'ghost'` | Borderless, or outlined on a surface fill. |
| `size` | `'md' \| 'sm'` | `'md'` | 32px or 28px square. |
| `type` | `'button' \| 'submit' \| 'reset'` | `'button'` | Native button type. |
| `className` | `string` | - | Extra classes merged onto the button. |

Spreads remaining `ButtonHTMLAttributes<HTMLButtonElement>` (except `aria-label`) onto the `<button>` and forwards its ref.

## Variants

- `ghost` - transparent until hovered, icon in `fg-muted`.
- `secondary` - surface fill with the control outline.
- `disabled` (native attribute) - `fg-disabled` icon, no hover.

## Usage

```tsx
import { IconButton } from '@/components/design-system/atoms/IconButton/IconButton';
```

Toolbar action (the icon is passed in by the composing molecule):

```tsx
<IconButton label="Refresh" onClick={onRefresh}>
  {refreshIcon}
</IconButton>
```

Small and outlined:

```tsx
<IconButton label="Dismiss" variant="secondary" size="sm" onClick={onDismiss}>
  {closeIcon}
</IconButton>
```

## a11y

- Renders a native `<button>` with `aria-label={label}`; the icon child must be `aria-hidden`.
- Shows the 2px focus ring on keyboard focus.
- An icon-only button should also show a tooltip with the same text; wrap it in `Tooltip` from a molecule. The ref is forwarded so it works as a tooltip trigger.

## Motion

- Hover and disabled colours ease over 120ms, and an enabled button scales to 98% while it is pressed. The focus ring is not transitioned, so it appears at once.
- Under `prefers-reduced-motion` the global rule makes this instant.
