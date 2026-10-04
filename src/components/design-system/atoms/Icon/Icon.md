# Icon

**Level:** Atom
**Purpose:** Draws one Lucide glyph by name at a fixed size with a 1.5 stroke in the current text colour.

## When to use

- Every icon in the app: beside a label, inside an `IconButton`, in an empty or error state.
- 16px by default; 20px in the sidebar rail and in empty states; 12px or 14px inside badges and dense rows.

## When NOT to use

- A glyph that is not in the name list - add it to `ICONS` in `utils.ts` and to `IconName` in `types.ts` first.
- Conveying meaning on its own - pair it with a word, or put it in an `IconButton` that carries the label.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `name` | `IconName` | required | Which glyph to draw (see the list below). |
| `size` | `12 \| 14 \| 16 \| 20` | `16` | Width and height in pixels. |
| `className` | `string` | - | Extra classes, usually a text colour such as `text-fg-subtle`. |

Names: `layout`, `activity`, `bot`, `workflow`, `trending`, `layers`, `bars`, `list`, `folder`, `sparkles`,
`sliders`, `settings`, `search`, `sun`, `moon`, `panel`, `chevronRight`, `chevronDown`, `chevronUp`,
`chevronLeft`, `check`, `x`, `clock`, `download`, `alert`, `info`, `arrowUpRight`, `refresh`, `inbox`, `copy`,
`externalLink`, `filter`, `calendar`, `tag`, `gitBranch`, `terminal`, `file`, `help`, `plus`, `minus`, `trash`,
`menu`, `eye`, `command`.

## Usage

```tsx
import { Icon } from '@/components/design-system/atoms/Icon/Icon';
```

Beside a label (inherits the label colour):

```tsx
<Icon name="download" />
```

Small and tinted:

```tsx
<Icon name="alert" size={14} className="text-warning-fg" />
```

## a11y

- Always `aria-hidden` and not focusable: an icon is decoration.
- The accessible name comes from the surrounding text or from the control that wraps it.

## Notes

- Colour is `currentColor`; set it with a text colour class on the icon or its parent.
- Only the glyphs in the `ICONS` map are bundled. Molecules and above use this atom instead of importing `lucide-react`; an atom cannot import another atom, so one that needs a built-in glyph (`Select`'s chevron and check) imports it from `lucide-react` itself.
