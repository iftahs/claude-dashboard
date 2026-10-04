# PageHeader

**Level:** Atom
**Purpose:** Row under the topbar that pairs a one-line page description, or other left content, with the page's actions on the right.

## When to use

- The first row of every page: one sentence saying what the page shows, with the range picker and export on the right.
- With `children` when the left side is a control instead of a sentence, such as the page's `Tabs`.

## When NOT to use

- The page title - that is the `text-title` heading in the topbar.
- The header of a card - use `CardHeader`.
- A heading for a group of cards - use `GroupLabel`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `description` | `ReactNode` | - | One sentence in `text-body`, `fg-muted`. Ignored when `children` is passed. |
| `children` | `ReactNode` | - | Replaces the description on the left, for example a `Tabs` list. |
| `actions` | `ReactNode` | - | Right slot: controls laid out in a row with an 8px gap. |
| `className` | `string` | - | Extra classes merged onto the row. |

## Variants

- From `md` up: one row, at least 32px tall, the left content takes the free width and the actions stay their own width, vertically centred.
- Below `md`: the actions drop onto their own line under the left content and may wrap.

## Usage

```tsx
import { PageHeader } from '@/components/design-system/atoms/PageHeader/PageHeader';
```

Description and actions (the controls are composed by the page):

```tsx
<PageHeader description="Your current window, plan limits and what is driving them." actions={rangeAndExport} />
```

Tabs on the left:

```tsx
<PageHeader actions={rangeAndExport}>{viewTabs}</PageHeader>
```

## a11y

- Layout only: it adds no roles and no heading. The page's `<h1>` lives in the topbar.
- The description is a `<p>`; the controls in `actions` keep their own names and focus order (left content first, then actions).

## Notes

- It imports no design-system component and only arranges the nodes it is given, so it is an atom.
- The row has no margin; the page's gap sets the spacing to the first section.
- With a 36px `Tabs` list on the left, small 28px actions sit centred against it, 4px above the list's hairline.
