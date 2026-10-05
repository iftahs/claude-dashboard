# Topbar

**Level:** Organism
**Purpose:** Row of global controls for the app shell: the page title, the platform and surface switchers, limit and agent status chips, the command palette button, the theme toggle and the live indicator.

## When to use

- Once, as the `topbar` slot of `AppShellLayout`.
- `platform` and `surface` only when the reader has a choice to make; leave them out and the switchers are not rendered.
- `limit` and `agents` to keep the two states worth a click in view from every page.

## When NOT to use

- Actions that belong to one page - put them in that page's `PageHeader`.
- A second title: the `<h1>` here is the only `text-title` on a page.
- Never fetch, route or read storage here. The connected component passes the values and the handlers.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `title` | `string` | required | The page name, rendered as the page's `<h1>`. Truncates with an ellipsis. |
| `drawerOpen` | `boolean` | required | Whether the navigation drawer is open, for the menu button's `aria-expanded`. |
| `onOpenDrawer` | `() => void` | required | Called by the menu button, which is shown below `lg` only. |
| `platform` | `TopbarScope<P> \| null` | - | The platform switcher (see below). |
| `surface` | `TopbarScope<S> \| null` | - | The surface switcher, after the platform one. |
| `limit` | `TopbarLimit \| null` | - | The limit chip (see below). |
| `agents` | `TopbarAgents \| null` | - | The agents chip (see below). |
| `shortcut` | `string` | required | The palette shortcut as it reads on a key cap: "Ctrl K". |
| `onOpenPalette` | `() => void` | required | Called by the "Jump to" button. |
| `theme` | `'dark' \| 'light'` | required | The active theme, for the theme toggle. |
| `onToggleTheme` | `() => void` | required | Called by the theme toggle. |
| `live` | `{ state: 'live' \| 'paused' \| 'error'; label?: string }` | required | The live indicator's state and optional caption. |
| `onNavigate` | `(href: string, event: MouseEvent<HTMLAnchorElement>) => void` | - | Called when a chip is clicked, for client-side routing. |

`TopbarScope<T>`: `label` (accessible name of the group, "Platform"), optional `help` (tooltip under the control), `options`, `value` and `onChange`, as `SegmentedControl` takes them. `P` and `S` are inferred from the options.

`TopbarLimit`: `href`, `window` ("Weekly"), `value` ("83%"), `tone` (`'neutral' | 'warning' | 'danger'`) and optional `title` for the tooltip.

`TopbarAgents`: `href`, `count`, `label` ("running", "waiting on you"), `tone` (`'neutral' | 'danger'`), optional `running` (pulsing dot) and `title`.

## Variants

- Left to right: menu button (below `lg`), title, platform, surface, a hairline divider, limit chip, agents chip, "Jump to", theme toggle, live indicator.
- Limit chip: `neutral` shows the text alone; `warning` and `danger` add the alert icon.
- Agents chip: `danger` shows the alert icon, `running` a pulsing dot, otherwise the bot icon.

## Responsive behaviour

The title takes the space that is left and truncates first, so the secondary text gives way before it does.

- Chips spell out their phrase ("Weekly 83%", "3 running") from `xl` (1280px). Below it they keep the number and their icon or dot; the full phrase stays in the accessible name and the tooltip.
- With at most one switcher: the "Jump to" label and the divider show from `xl`, the key cap from `md` (768px), and controls sit 12px apart from `xl`, 8px from `lg` and 6px below.
- With both switchers there is less room, so each step comes one breakpoint later: the label and the divider from `2xl` (1536px), the key cap from `xl`, the live caption from `xl` (below it the dot alone, with the caption kept for screen readers), and gaps of 12px from `2xl`, 8px from `xl`, 6px from `lg` and 4px below.
- The menu button shows below `lg` (1024px).
- The surface switcher is hidden below `md` and the platform switcher below `sm` (640px). The command palette offers both at every width.

## Usage

```tsx
import { Topbar } from '@/components/design-system/organisms/Topbar/Topbar';
```

In the app shell, wired by the connected component:

```tsx
<Topbar
  title="Live usage"
  drawerOpen={drawerOpen}
  onOpenDrawer={openDrawer}
  platform={{ label: 'Platform', options: platformOptions, value: platform, onChange: setPlatform }}
  surface={showSurface ? { label: 'Surface', options: surfaceOptions, value: surface, onChange: setSurface } : null}
  limit={{ href: '/live', window: 'Weekly', value: '83%', tone: 'warning', title: 'Claude weekly limit: 83% used' }}
  agents={{ href: '/agents', count: 3, label: 'running', tone: 'neutral', running: true }}
  shortcut="Ctrl K"
  onOpenPalette={openPalette}
  theme={theme}
  onToggleTheme={toggleTheme}
  live={{ state: 'live' }}
  onNavigate={navigateTo}
/>
```

Minimal, for a reader with one platform and no live limit:

```tsx
<Topbar
  title="Overview"
  drawerOpen={false}
  onOpenDrawer={openDrawer}
  shortcut="Ctrl K"
  onOpenPalette={openPalette}
  theme={theme}
  onToggleTheme={toggleTheme}
  live={{ state: 'live' }}
/>
```

## a11y

- The title is the page's only `<h1>`.
- The menu button is named "Open navigation" and carries `aria-expanded`. Each switcher is a group named by its `label`.
- The chips are links named by their full phrase even when part of it is hidden. `warning` and `danger` add an icon, so the tone never rests on colour alone.
- The "Jump to" button is named "Jump to", announces a dialog and lists the shortcut in `aria-keyshortcuts`. Its hover text is a native `title`, not a `Tooltip`: focus returns to it when the palette closes, and a tooltip would reopen every time.

## Notes

- The root takes `flex-1 min-w-0`, as the `AppShellLayout` topbar slot expects.
- It never routes by itself: the chips are real `<a href>` and `onNavigate` lets the consumer call `event.preventDefault()` and navigate.
