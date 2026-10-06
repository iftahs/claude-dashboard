# DropdownMenu

**Level:** Molecule
**Purpose:** Menu of actions that opens from a trigger element, with an optional icon, a danger tone and a disabled state per item.

## When to use

- Several secondary actions on one thing that do not deserve a button each: a row's "more" menu, an export format menu.
- `tone: 'danger'` for the destructive item, placed last.

## When NOT to use

- Picking a value that stays selected - use `Select` or `SegmentedControl`.
- One or two actions - show them as buttons.
- Navigation between pages - use links.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `trigger` | `ReactElement` | required | The element that opens the menu: one element that accepts a ref and spread props, usually a `Button` or an `IconButton`. |
| `items` | `readonly DropdownMenuItem[]` | required | The actions, in display order (see below). |
| `align` | `'start' \| 'center' \| 'end'` | `'start'` | Which edge of the trigger the menu lines up with. Use `end` for a trigger at the right edge of a row. |

`DropdownMenuItem`:

| Field | Type | Default | Description |
|---|---|---|---|
| `key` | `string` | required | Unique, stable id of the item. |
| `label` | `string` | required | The action, in sentence case, starting with a verb. |
| `icon` | `IconName` | - | A 16px glyph before the label. |
| `onSelect` | `() => void` | required | Called when the item is chosen; the menu then closes. |
| `tone` | `'default' \| 'danger'` | `'default'` | `danger` draws the item in `danger-fg` with a `danger-soft` highlight. |
| `disabled` | `boolean` | `false` | Greys the item out and skips it. |

## Variants

- Item: 32px tall, `text-body`, `fg-muted`; the highlighted item (pointer or keyboard) gets `surface-hover` and `fg`.
- `danger` item: `danger-fg`, highlighted on `danger-soft`.
- Disabled item: `fg-disabled`, never highlighted.
- List: `surface-raised`, `line` border, `shadow-pop`, `rounded-control`, 4px padding, at least 180px wide - the same look as the `Select` list.

## Usage

```tsx
import { DropdownMenu } from '@/components/design-system/molecules/DropdownMenu/DropdownMenu';
```

Row actions behind an icon button (the trigger is composed by the organism):

```tsx
<DropdownMenu
  align="end"
  trigger={moreButton}
  items={[
    { key: 'open', label: 'Open transcript', icon: 'file', onSelect: onOpen },
    { key: 'copy', label: 'Copy session id', icon: 'copy', onSelect: onCopy },
    { key: 'forget', label: 'Forget session', icon: 'trash', tone: 'danger', onSelect: onForget },
  ]}
/>
```

Export formats from a button:

```tsx
<DropdownMenu trigger={exportButton} items={[{ key: 'csv', label: 'Export CSV', onSelect: onCsv }, { key: 'json', label: 'Export JSON', onSelect: onJson, disabled: !hasData }]} />
```

## a11y

- Built on Radix Dropdown Menu: the trigger gets `aria-haspopup="menu"` and `aria-expanded`; the list is a `role="menu"` of `menuitem`s labelled by the trigger.
- Enter, Space or Arrow Down on the trigger opens it; arrow keys, Home, End and typeahead move through the items; Enter or Space chooses; Escape closes and returns focus to the trigger.
- The highlighted item is the focus indicator inside the list. The trigger keeps its own focus ring and needs its own accessible name (an `IconButton` label).
- The danger tone is paired with the item's words; never rely on the colour to say an action is destructive.

## Notes

- The trigger is passed through Radix `asChild`, so a function component used as the trigger must forward its ref (`Button` and `IconButton` do).
- Uncontrolled: it opens and closes itself. Renders in a portal at `z-50` and scrolls when taller than the space available.
- The portal is outside the app shell, so the list sets its own `text-body`, `fg` and tabular numerals.

## Exports

- `DropdownMenuItem`, `DropdownMenuAlign` and `DropdownMenuItemTone` from `types.ts`, for consumers that build the `items` array.
