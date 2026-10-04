# TableRow

**Level:** Atom
**Purpose:** Table row with a top hairline, an optional hover fill and a selected state.

## When to use

- Every row inside a `Table`, in `<thead>` and in `<tbody>`.
- `interactive` when the whole row can be clicked; `state="selected"` for the row whose detail is open.

## When NOT to use

- Outside a `<table>` - a `<tr>` is only valid there.
- A list of cards or meter rows - those are not tabular.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `state` | `'default' \| 'selected'` | `'default'` | `selected` fills the row with `accent-soft` and sets its text to `accent-fg`. |
| `interactive` | `boolean` | `false` | Adds the `surface-hover` hover fill, a pointer cursor and a focus ring. |
| `children` | `ReactNode` | - | `TableCell`s. |
| `className` | `string` | - | Extra classes merged onto the `<tr>`. |

Spreads remaining `HTMLAttributes<HTMLTableRowElement>` onto the `<tr>`.

## Variants

- `default` - transparent, top hairline in `border-line`.
- `selected` - `accent-soft` fill, `accent-fg` text; numeric cells stay `fg-muted`.
- `interactive` - hover fill on unselected rows.
- A row inside `<thead>` drops its top hairline.

## Usage

```tsx
import { TableRow } from '@/components/design-system/atoms/TableRow/TableRow';
```

Header and plain body rows:

```tsx
<thead>
  <TableRow>{headerCells}</TableRow>
</thead>
<tbody>
  <TableRow>{cells}</TableRow>
</tbody>
```

Clickable row, selected when its detail is open:

```tsx
<TableRow interactive state={isOpen ? 'selected' : 'default'} onClick={onOpen}>
  {cells}
</TableRow>
```

## a11y

- Renders a native `<tr>`.
- `interactive` is visual only. A clickable row must also be reachable by keyboard: put a real link or button in its first cell, or give the row `tabIndex={0}` and an Enter/Space handler. The focus ring is drawn inside the row so a clipping card does not hide it.
- Selection is shown by fill and text colour together; expose it to assistive tech on the control that toggles it (for example `aria-expanded` or `aria-current`).
