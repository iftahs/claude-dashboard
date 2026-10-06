# GroupLabel

**Level:** Atom
**Purpose:** Uppercase section heading in the label style, with an optional quiet note after it.

## When to use

- Naming a group of cards on a page: Limits, Running now, Today.
- Naming a group inside a panel, such as a sidebar nav group or a list of phases (`as="span"` or `as="h3"`).
- With `note` for one short qualifier: a count, a plan name, a range.

## When NOT to use

- The title of a card - use `CardHeader`.
- The page title - that is the one `text-title` in the topbar.
- A form label - use `FormField`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `ReactNode` | required | The label text, written in sentence case; it is uppercased by the style. |
| `as` | `'h2' \| 'h3' \| 'span'` | `'h2'` | The element for the label. Pick the heading level that fits the page outline, or `span` when it is not a heading. |
| `note` | `ReactNode` | - | Shown after the label in `text-caption`, not uppercased. |
| `id` | `string` | - | Id of the label element, so a region can point `aria-labelledby` at it. |
| `className` | `string` | - | Extra classes merged onto the row, for example padding. |

## Variants

- One look: `text-label`, uppercase, `fg-subtle`. The note is `text-caption` in `fg-subtle`.

## Usage

```tsx
import { GroupLabel } from '@/components/design-system/atoms/GroupLabel/GroupLabel';
```

Page section with a note:

```tsx
<GroupLabel note="How much of each window is used">Limits</GroupLabel>
```

Labelling a region, one level down:

```tsx
<section aria-labelledby="phases-label">
  <GroupLabel as="h3" id="phases-label">Phases</GroupLabel>
  {phases}
</section>
```

## a11y

- Renders a real `<h2>` or `<h3>` by default, so it appears in the heading outline. Use `as="span"` only when the text is not a heading.
- The uppercase is a style: screen readers get the sentence-case text.
- The note sits outside the heading, so it is not part of the heading's name.

## Notes

- The label and the note each stay on one line and truncate with an ellipsis.
- The row has no margin; the parent's gap sets the spacing.
