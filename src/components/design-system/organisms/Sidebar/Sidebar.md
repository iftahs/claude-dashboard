# Sidebar

**Level:** Organism
**Purpose:** App navigation: the product name with the collapse button, grouped page links with live badges, pinned links at the bottom and a footer with the data folders, version and credit.

## When to use

- Once, as the `sidebar` slot of `AppShellLayout`.
- `collapsed` for the 56px rail: icons only, labels and badges move into tooltips, the footer is hidden.
- `pinned` for the links that stay at the bottom whatever the height, such as Settings.

## When NOT to use

- Switching views inside a page - use `Tabs`.
- A list of links in the page body - compose `NavItem` or plain links there.
- Never fetch, route or read storage here. The connected component passes the items, the active id and the handlers.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `brand` | `string` | required | The product name, in plain `text-heading`. There is no logo. |
| `groups` | `readonly SidebarGroup[]` | required | The navigation groups, in display order (see below). |
| `pinned` | `readonly SidebarItem[]` | `[]` | Links pinned to the bottom of the navigation, above the footer. |
| `activeId` | `string` | required | `id` of the item for the current page. |
| `collapsed` | `boolean` | `false` | Rail mode. |
| `toggleIcon` | `IconName` | required | Glyph of the button beside the name: `panel` to collapse or expand, `x` to close the drawer. |
| `toggleLabel` | `string` | required | Name and tooltip of that button: "Collapse sidebar", "Expand sidebar", "Close navigation". |
| `onToggle` | `() => void` | required | Called when that button is clicked. |
| `onNavigate` | `(href: string, event: MouseEvent<HTMLAnchorElement>) => void` | - | Called when a link is clicked, for client-side routing. |
| `dataDirs` | `readonly SidebarDataDir[]` | `[]` | The folders the data on screen is read from. One is shown as a bare path; several get their `label` in front. |
| `version` | `SidebarVersion \| null` | - | App version, update state and repository link for the footer. |
| `credit` | `SidebarCredit` | - | Author line: "Built by" and a link. |
| `navLabel` | `string` | `'Main'` | Accessible name of the `<nav>`. |

`SidebarGroup`: `id`, `label` (shown uppercase above the group) and `items`.

`SidebarItem`:

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique, stable id; compared with `activeId`. |
| `href` | `string` | Where the link goes. |
| `label` | `string` | The page name, in sentence case. |
| `icon` | `IconName` | The glyph. |
| `badge` | `{ text: string; tone?: BadgeTone; title?: string }` | A count or a percentage after the label. `title` is its hover text. |

`SidebarDataDir`: `label` ("Claude", "Cowork", "Codex") and `path`.

`SidebarVersion`: `current`, `latest`, `updateAvailable`, `changelogUrl`, `repoUrl` - all optional. With `updateAvailable` and `latest` an "Update available" badge follows the version and links to `changelogUrl`.

`SidebarCredit`: `name` and `href`.

## Variants

- Expanded: 16px of padding above and below, 12px at the sides, 20px between the name row, the groups and the bottom block; items sit 2px apart.
- `collapsed`: 12px of padding on the left and 11px on the right, the toggle button centred, no group labels and no footer.

## Usage

```tsx
import { Sidebar } from '@/components/design-system/organisms/Sidebar/Sidebar';
```

In the app shell, wired by the connected component:

```tsx
<Sidebar
  brand="AI Usage"
  groups={groups}
  pinned={[settingsItem]}
  activeId={activeRouteId}
  collapsed={sidebarCollapsed && !drawerOpen}
  toggleIcon={drawerOpen ? 'x' : 'panel'}
  toggleLabel={drawerOpen ? 'Close navigation' : 'Collapse sidebar'}
  onToggle={drawerOpen ? closeDrawer : toggleSidebar}
  onNavigate={navigateTo}
  dataDirs={dataDirs}
  version={version}
  credit={{ name: 'Iftah Saar', href: 'https://iftah.dev' }}
/>
```

One group with a badge:

```tsx
<Sidebar
  brand="AI Usage"
  activeId="live"
  toggleIcon="panel"
  toggleLabel="Collapse sidebar"
  onToggle={onToggle}
  groups={[
    {
      id: 'monitor',
      label: 'Monitor',
      items: [
        { id: 'overview', href: '/overview', label: 'Overview', icon: 'layout' },
        { id: 'live', href: '/live', label: 'Live usage', icon: 'activity', badge: { text: '83%', tone: 'warning' } },
      ],
    },
  ]}
/>
```

## a11y

- The links sit in a `<nav>` named by `navLabel`; each group is a `role="group"` named by its label, so the grouping survives in the rail where the labels are hidden. The pinned links are in the same `<nav>`.
- The current page's link carries `aria-current="page"`.
- The toggle button is named by `toggleLabel` and shows it in a tooltip on the right.
- Footer paths truncate and keep the full path in their `title`. Footer links open in a new tab.

## Private parts

- `SidebarFooter` - the block under the pinned links: data folders in monospace, the version with the update badge, the credit and the repository link.

## Notes

- The root takes `flex-1`, as the `AppShellLayout` sidebar slot expects, and brings its own padding.
- It holds no element ids, because `AppShellLayout` mounts the slot twice while the drawer is open.
- It never routes by itself: links are real `<a href>` and `onNavigate` lets the consumer call `event.preventDefault()` and navigate.

## Motion

- Nav items ease their colours. The brand, group labels, item labels and footer fade in (180ms) when the sidebar mounts expanded, so on expand and in the drawer.
- The width animation belongs to `AppShellLayout`.
- Under `prefers-reduced-motion` the global rule makes this instant.
