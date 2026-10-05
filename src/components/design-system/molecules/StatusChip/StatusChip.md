# StatusChip

**Level:** Molecule
**Purpose:** Compact link on a soft status fill that names a live state and leads to the page that explains it.

## When to use

- A state in the topbar that is worth a click from any page: the binding limit ("Weekly 83%"), the agents that are running or waiting on you.
- `warning` and `danger` with `icon="alert"`, so the tone never rests on colour alone.
- `pulse` for something happening right now, such as running agents.

## When NOT to use

- A status that does not navigate - use `Badge`.
- A model, project or branch identifier - use `Chip`.
- An action that changes something - use `Button`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `href` | `string` | required | Where the chip goes. Keeps middle-click and "open in new tab" working. |
| `children` | `ReactNode` | - | The text, one short phrase: "Weekly 83%", "3 running". |
| `tone` | `'neutral' \| 'success' \| 'warning' \| 'danger' \| 'info'` | `'neutral'` | Colour pair. |
| `icon` | `IconName` | - | A 14px glyph before the text. |
| `pulse` | `boolean` | `false` | Leads with a pulsing `success` dot. |
| `tooltip` | `ReactNode` | - | Longer explanation shown below the chip on hover and focus. |
| `className` | `string` | - | Extra classes merged onto the link. |

Spreads remaining `AnchorHTMLAttributes<HTMLAnchorElement>` (except `title`) onto the `<a>`.

## Variants

- `neutral` - `surface-hover` fill, `fg-muted` text that turns `fg` on hover.
- `success`, `warning`, `danger`, `info` - the tone's `-soft` fill with its `-fg` text.
- 28px tall, `rounded-control`, `text-small` medium, 8px side padding and 6px gap.

## Usage

```tsx
import { StatusChip } from '@/components/design-system/molecules/StatusChip/StatusChip';
```

A limit that crossed 70%:

```tsx
<StatusChip href="/live" tone="warning" icon="alert" tooltip="Claude weekly limit: 83% used" onClick={onNavigate}>
  Weekly 83%
</StatusChip>
```

Running agents:

```tsx
<StatusChip href="/agents" icon="bot" pulse onClick={onNavigate}>
  3 running
</StatusChip>
```

## a11y

- Renders a native `<a href>`: focusable, activated with Enter, shows the 2px focus ring.
- The text is the link's name. When part of it is hidden at narrow widths, pass the full phrase as `aria-label`.
- The icon and the dot are decorative.
- The tooltip is a description, opened on hover and on keyboard focus.

## Notes

- Never wraps and never shrinks.
- It never routes by itself. The consumer passes `onClick`, calls `event.preventDefault()` and navigates.
