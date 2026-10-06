# TableCell

**Level:** Atom
**Purpose:** Table cell that renders a column header, a text cell or a right-aligned monospace number.

## When to use

- Every cell inside a `TableRow`.
- `header` for column heads, `numeric` for tokens, cost, counts and times, `truncate` for the one long text column.

## When NOT to use

- Outside a `<tr>`.
- Holding block layouts such as charts or cards - a cell holds a short value, a chip or a badge.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `header` | `boolean` | `false` | Renders `<th scope="col">` in the uppercase `label` style on `surface-sunken`. |
| `align` | `'left' \| 'right'` | `'left'`, or `'right'` when `numeric` | Horizontal alignment. |
| `numeric` | `boolean` | `false` | Body cells: monospace 12px in `fg-muted`, never wraps. Header cells: only the right alignment. |
| `truncate` | `boolean` | `false` | Single line with an ellipsis; the column takes the width the other columns leave. |
| `children` | `ReactNode` | - | The cell content. |
| `className` | `string` | - | Extra classes merged onto the cell, for example a column width such as `w-24`. |

Spreads remaining `TdHTMLAttributes<HTMLTableCellElement>` (except the legacy `align` attribute) onto the cell, so `colSpan`, `title` and `scope` pass through.

## Variants

- Body cell - 40px tall, inherits the row's text colour.
- `header` - 36px tall, `text-label`, uppercase, `fg-subtle`, `surface-sunken` fill.
- `numeric` - `font-mono`, `text-mono`, `fg-muted`, right aligned.
- `truncate` - ellipsis, no wrap.
- Cells are padded 8px on each side, 16px on the row's outer edges.

## Usage

```tsx
import { TableCell } from '@/components/design-system/atoms/TableCell/TableCell';
```

Header cells:

```tsx
<TableCell header>Session</TableCell>
<TableCell header numeric>Est. cost</TableCell>
```

Body cells:

```tsx
<TableCell truncate title={session.title}>{session.title}</TableCell>
<TableCell numeric>~$7.88</TableCell>
```

## a11y

- `header` renders `<th scope="col">`; pass `scope="row"` for a row header.
- A truncated cell hides part of its text: pass the full text as `title`, or wrap the content in a `Tooltip` from a molecule.
- Alignment and colour carry no meaning on their own; the column header names the value.

## Notes

- `truncate` works by giving the cell `max-width: 0` and `width: 100%`. Use it on one column per table and let the other columns size to their content or to a width class.
