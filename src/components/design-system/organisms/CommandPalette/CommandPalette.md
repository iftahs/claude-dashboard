# CommandPalette

**Level:** Organism
**Purpose:** Modal search box that filters grouped commands as the reader types and runs the chosen one from the keyboard or with a click.

## When to use

- Once, at the root of the app, opened with Ctrl+K or Cmd+K and from the topbar's "Jump to" button.
- Navigation and quick actions that are already reachable elsewhere on screen: go to a page, switch platform, switch theme.
- `current` on the item for where the reader already is: the current page, the selected platform.

## When NOT to use

- Searching data (sessions, projects, transcripts) - that is a page with its own search field.
- A short list of actions on one thing - use `DropdownMenu`.
- The only way to reach an action. Every command must also have a visible control.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `open` | `boolean` | required | Whether the palette is shown. |
| `onOpenChange` | `(open: boolean) => void` | required | Called with `false` on Escape, a click on the overlay and after a command is chosen. |
| `groups` | `readonly CommandPaletteGroup[]` | required | The commands, grouped, in display order (see below). |
| `title` | `string` | `'Command palette'` | Accessible name of the dialog and of the list. Not shown. |
| `placeholder` | `string` | `'Jump to a page or run an action'` | Placeholder of the search field. |
| `emptyLabel` | `string` | `'Nothing matches. Try a page name or an action.'` | Shown when the search matches no command. |

`CommandPaletteGroup`: `id`, `heading` (shown uppercase above the group) and `items`.

`CommandPaletteItem`:

| Field | Type | Default | Description |
|---|---|---|---|
| `id` | `string` | required | Unique, stable id of the command. |
| `label` | `string` | required | What it does, in sentence case. It is also what the search matches, so it must be unique. |
| `icon` | `IconName` | - | A 16px glyph before the label. |
| `keywords` | `readonly string[]` | - | Extra words the search matches: "dark", "appearance". |
| `hint` | `string` | - | A key cap after the label, for a command that has its own shortcut. |
| `current` | `boolean` | `false` | Marks the command with a check: it describes the state the app is already in. |
| `onSelect` | `() => void` | required | Called when the command is chosen. The palette closes first. |

## Variants

- Panel: 560px wide at most and 16px clear of the viewport edges, 12% from the top, `surface-raised`, `line` border, `shadow-pop`, `rounded-dialog`. Overlay: `bg-overlay`.
- Item: 32px tall, `text-body`, `fg-muted`; the highlighted item (pointer or keyboard) gets `surface-hover` and `fg`.
- A footer of `Kbd` hints: arrows to move, Enter to select, Esc to close.

## Usage

```tsx
import { CommandPalette } from '@/components/design-system/organisms/CommandPalette/CommandPalette';
```

In the app shell, with the groups built by a hook:

```tsx
<CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} groups={commandGroups} />
```

The shape of the groups:

```tsx
<CommandPalette
  open={open}
  onOpenChange={setOpen}
  groups={[
    {
      id: 'go',
      heading: 'Go to',
      items: [
        { id: 'go-live', label: 'Live usage', icon: 'activity', current: true, onSelect: goToLive },
        { id: 'go-agents', label: 'Agents', icon: 'bot', onSelect: goToAgents },
      ],
    },
    {
      id: 'actions',
      heading: 'Actions',
      items: [{ id: 'theme', label: 'Switch to light theme', icon: 'sun', keywords: ['appearance'], onSelect: toggleTheme }],
    },
  ]}
/>
```

## a11y

- Built on Radix Dialog and `cmdk`: `role="dialog"` named by `title`, focus trapped inside and returned on close to the element that had it. The page behind is inert.
- Focus starts in the search field, a `combobox` that controls the `listbox` of commands. Up and Down move the highlight and wrap around, Enter runs the highlighted command, Escape closes.
- The search field keeps the 2px focus ring. Group headings are decorative; each group is named by its heading.
- The key caps in the footer are hints only.

## Notes

- Controlled only: the consumer owns `open` and registers the keyboard shortcut in a hook. This component listens for no global key.
- The search text is cleared each time the palette closes.
- Renders in a portal at `z-50`, outside the app shell, so the panel sets its own `text-body`, `fg` and tabular numerals.
- It does not animate.
