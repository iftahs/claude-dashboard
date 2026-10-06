# NavItem

**Level:** Molecule
**Purpose:** Sidebar link with an icon, a label and an optional badge, which collapses to an icon with a tooltip in the rail.

## When to use

- One entry in the sidebar navigation: Overview, Live usage, Agents, Settings.
- `badge` for a count or a state that belongs to that page: `3` running agents, `83%` of a limit.
- `collapsed` when the sidebar is the 56px rail.

## When NOT to use

- Switching views inside a page - use `Tabs`.
- An action that does not navigate - use `Button` or `IconButton`.
- A link in body text - render a plain `<a>`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `href` | `string` | required | Where the link goes. Keeps middle-click and "open in new tab" working. |
| `label` | `string` | required | The page name, in sentence case. Truncates with an ellipsis. |
| `icon` | `IconName` | required | The glyph, from the `Icon` name list. |
| `active` | `boolean` | `false` | Marks the current page: `accent-soft` fill, `accent-fg` text, `aria-current="page"`. |
| `collapsed` | `boolean` | `false` | Icon only: the label moves to a tooltip on the right and to `aria-label`. |
| `badge` | `ReactNode` | - | Trailing node, usually a `Badge`. In the rail it is shown inside the tooltip. |
| `onClick` | `(event: MouseEvent<HTMLAnchorElement>) => void` | - | Click handler, for client-side routing: call `event.preventDefault()` and navigate. |
| `className` | `string` | - | Extra classes merged onto the link. |

## Variants

- `active`: `accent-soft` fill with `accent-fg` text. Otherwise `fg-muted`, with a `surface-hover` fill and `fg` text on hover.
- `collapsed`: a centred 20px icon, no label, no badge. Expanded: a 16px icon, the label and the badge.
- 32px tall, `rounded-control`, `text-body` medium, 8px side padding and 8px gap.

## Usage

```tsx
import { NavItem } from '@/components/design-system/molecules/NavItem/NavItem';
```

Expanded, current page, with a badge composed by the sidebar organism:

```tsx
<NavItem href="/live" label="Live usage" icon="activity" active badge={limitBadge} onClick={onNavigate} />
```

In the rail:

```tsx
<NavItem href="/agents" label="Agents" icon="bot" collapsed badge={agentCountBadge} onClick={onNavigate} />
```

## a11y

- Renders a native `<a href>`: focusable, activated with Enter, shows the 2px focus ring.
- The current page carries `aria-current="page"`; the fill and the text colour repeat it visually.
- Collapsed, the link is named by `aria-label={label}` and the tooltip shows the label (and the badge) on hover and on focus.
- The icon is decorative. A badge inside the link is read as part of its name, so keep it to a short count or percentage.

## Notes

- Fills the width of its container: stack items in a column with a 2px gap.
- It never routes by itself. The page or a hook passes `onClick` and decides how to navigate.

## Motion

- Hover and active colours ease over 120ms.
- The label fades in (180ms) whenever the item mounts expanded, which is what happens when the rail expands.
- Under `prefers-reduced-motion` the global rule makes this instant.
