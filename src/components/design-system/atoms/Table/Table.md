# Table

**Level:** Atom
**Purpose:** Full-width table element that sets the base type and holds header and body rows.

## When to use

- Rows of records with the same columns: sessions, runs, models, limit hits.
- As the root of a table built from `TableRow` and `TableCell` inside native `<thead>` and `<tbody>`.

## When NOT to use

- Layout - use flex or grid.
- A label and a value per line - use a definition list or meter rows.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `caption` | `string` | - | What the table lists. Rendered as a visually hidden `<caption>`. |
| `children` | `ReactNode` | - | `<thead>` and `<tbody>` holding `TableRow`s. |
| `className` | `string` | - | Extra classes merged onto the `<table>`. |

Spreads remaining `TableHTMLAttributes<HTMLTableElement>` onto the `<table>`.

## Usage

```tsx
import { Table } from '@/components/design-system/atoms/Table/Table';
```

`Table`, `TableRow` and `TableCell` are three atoms; a molecule or organism composes them:

```tsx
<Table caption="Recent sessions">
  <thead>
    <TableRow>
      <TableCell header>Session</TableCell>
      <TableCell header numeric>Tokens</TableCell>
    </TableRow>
  </thead>
  <tbody>
    <TableRow>
      <TableCell truncate>Fix workflow row widths</TableCell>
      <TableCell numeric>1.3M</TableCell>
    </TableRow>
  </tbody>
</Table>
```

## a11y

- Renders a native `<table>`; always pass `caption` so screen readers announce what it lists.
- Keep `<thead>` and `<tbody>` so header cells are associated with their columns.

## Notes

- `w-full`, collapsed borders, `text-body` in `fg`, tabular numerals.
- Put it in a `Card` with `padding="none"` and `overflow-hidden` for the standard look; wrap it in an `overflow-x-auto` element when it can be wider than its container.
