# CardHeader

**Level:** Molecule
**Purpose:** Top row of a card: its title and one-line description on the left, a help popover beside the title and an actions slot on the right.

## When to use

- The first child of a `Card` that holds a chart, a table or a list.
- `actions` for the card's own controls and status: a small `SegmentedControl`, a `Badge`, a legend, a small `Button`.
- `help` when the title uses a term that needs a sentence of explanation.

## When NOT to use

- The row under the topbar - use `PageHeader`.
- A heading above a group of cards - use `GroupLabel`.
- A stat tile - `StatTile` has its own label.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `title` | `string` | required | The card title in `text-heading`. Write it in sentence case; it is rendered as written. |
| `description` | `ReactNode` | - | One line under the title in `text-small`, `fg-muted`: the range, the unit, the grouping. |
| `help` | `ReactNode` | - | Explanation shown in an `InfoTip` beside the title. |
| `actions` | `ReactNode` | - | Right slot, laid out in a row with an 8px gap. Never shrinks. |
| `as` | `'h2' \| 'h3'` | `'h2'` | Heading level of the title. |
| `titleId` | `string` | - | Id of the heading, so the card can point `aria-labelledby` at it. |
| `className` | `string` | - | Extra classes merged onto the row, for example `mb-0` to drop the bottom margin. |

## Variants

- One look. The description, the help button and the actions each render only when passed.

## Usage

```tsx
import { CardHeader } from '@/components/design-system/molecules/CardHeader/CardHeader';
```

Title, description and a status in the actions slot (composed by the organism):

```tsx
<Card aria-labelledby="window-title">
  <CardHeader titleId="window-title" title="5-hour window" description="Started 23:10, resets 04:10" actions={statusBadge} />
  {body}
</Card>
```

With help, one heading level down:

```tsx
<CardHeader
  as="h3"
  title="What is contributing to your limits"
  description="Share of this week, weighted by cost"
  help="Weighted by estimated cost, from the attribution tags the CLI writes."
  actions={windowPicker}
/>
```

## a11y

- The title is a real heading (`<h2>` or `<h3>`); pick the level that fits the page outline, and pass `titleId` so the card is announced as a named region.
- The help button is named "About <title>" and opens on click, Enter or Space.
- Controls in `actions` come after the title in the focus order and keep their own names.

## Notes

- Carries a 16px bottom margin (`mb-4`), the gap between a card's header and its body. Override it with `className`.
- The title and the description wrap when the card is narrow; the actions keep their width, so keep that slot small (use 28px `sm` controls).
