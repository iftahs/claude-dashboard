# AppShellLayout

**Level:** Template
**Purpose:** Application frame with a sidebar column, a sticky topbar and a scrolling main area, where the sidebar becomes a modal drawer below 1024px.

## When to use

- Once, at the root of the app: every screen renders inside it.
- With a `PageLayout` as `children`, which adds the content width, gutters and section rhythm.

## When NOT to use

- Inside a page or a card - it takes the whole viewport height and sets the page background.
- For the content width, gutters or the gap between sections - that is `PageLayout`.
- Never fetch, route or read storage here. The adapter that renders it owns the collapsed and drawer state through a hook.

## Slots

| Slot | Rendered in | Description |
|---|---|---|
| `sidebar` | `<aside>` from `lg` up, the drawer below `lg` | The navigation. The container is a flex column on `surface`, so the slot's root should take `flex-1` to fill the height. It brings its own padding and its own `<nav>`. |
| `topbar` | sticky `<header>` | The page title and the global controls. The header is a 52px flex row with centred items and a 12px gap; a single root element should take `flex-1 min-w-0`. Below `lg` it should include the button that opens the drawer. |
| `children` | `<main id="main-content">` | The page. `<main>` is a flex column that fills the space under the topbar and has no padding. |

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `sidebar` | `ReactNode` | required | Sidebar slot. |
| `topbar` | `ReactNode` | required | Topbar slot. |
| `children` | `ReactNode` | required | Main content slot. |
| `sidebarCollapsed` | `boolean` | `false` | Sidebar column is the 56px rail (`w-rail`) instead of 240px (`w-sidebar`). No effect below `lg`. |
| `drawerOpen` | `boolean` | `false` | Shows the sidebar as a drawer below `lg`. Ignored from `lg` up. |
| `onDrawerClose` | `() => void` | - | Called when the scrim is clicked or Escape is pressed. The consumer sets `drawerOpen` to `false`. |
| `drawerLabel` | `string` | `'Navigation'` | Accessible name of the drawer dialog. |

This template does not spread native attributes - it only accepts the slots and props above.

## Responsive behaviour

- **`lg` (1024px) and up:** the sidebar is a fixed-width column (240px, or 56px when `sidebarCollapsed`) with a right hairline, as tall as the viewport, with its own vertical scroll. The right column scrolls on its own and the topbar stays pinned to its top. Topbar gutter is 32px.
- **Below `lg`:** the sidebar column is hidden. When `drawerOpen` is true the sidebar slot is rendered in a 240px drawer on the left with `shadow-pop`, above a full-screen `bg-overlay` scrim. Topbar gutter is 16px.
- The drawer is hidden by CSS from `lg` up even if `drawerOpen` is still true, so a resize never leaves it stranded.
- The shell is exactly one viewport tall (`h-dvh`); the document itself never scrolls.

## Usage

```tsx
import { AppShellLayout } from '@/components/design-system/templates/AppShellLayout/AppShellLayout';
```

In the app shell adapter, which owns the state through a hook:

```tsx
<AppShellLayout
  sidebar={sidebar}
  topbar={topbar}
  sidebarCollapsed={sidebarCollapsed}
  drawerOpen={drawerOpen}
  onDrawerClose={closeDrawer}
>
  <PageLayout header={pageHeader}>{sections}</PageLayout>
</AppShellLayout>
```

Minimal, no rail and no drawer:

```tsx
<AppShellLayout sidebar={sidebar} topbar={topbar}>
  {page}
</AppShellLayout>
```

## a11y

- Landmarks: `<aside>` for the sidebar column, `<header>` for the topbar, `<main id="main-content">` for the page. The `<nav>` and the `<h1>` belong to the slots.
- The first focusable element is a visually hidden "Skip to content" link that appears on focus and moves focus to `<main>`.
- The drawer is `role="dialog" aria-modal="true"` named by `drawerLabel`. Opening it moves focus into the drawer, Tab and Shift+Tab stay inside it, and Escape or a click on the scrim calls `onDrawerClose`. Closing it returns focus to the element that was focused when it opened, normally the menu button.
- An Escape press that an open menu or popover already handled does not close the drawer.
- The consumer provides the button that opens the drawer, with an accessible name and `aria-expanded`, and closes the drawer after a navigation.

## Notes

- Sets the page defaults for everything inside it: `bg-canvas`, `text-fg`, `font-sans`, `text-body` and tabular numerals. Content portaled to `<body>` (tooltips, menus, dialogs) is outside the shell and does not inherit them.
- While the drawer is open the `sidebar` slot is mounted twice (the hidden column and the drawer). Keep element ids out of it, and pass the expanded sidebar while the drawer is open: `collapsed={sidebarCollapsed && !drawerOpen}`.
- The drawer is always 240px wide and appears without animation.
- Layering: topbar `z-10`, drawer `z-40`, skip link `z-50`. Popovers and tooltips at `z-50` stay above the drawer.
- The scrolling column has `scroll-pt-topbar`, so anchors and focused elements are not hidden under the pinned topbar.
