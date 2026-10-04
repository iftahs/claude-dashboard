# InfoTip

**Level:** Atom
**Purpose:** Small help-icon button that opens a short explanation in a popover on click.

## When to use

- Defining a metric or a label that needs a sentence of explanation: what "effective tokens" counts, why a cost is an estimate.
- Beside a label, a card title or a stat tile label. `StatTile` and `CardHeader` render it through their `help` prop.

## When NOT to use

- Naming an icon-only button or showing a truncated name - use `Tooltip`.
- Information the reader needs to use the page - write it on the page.
- Content with links, buttons or form controls - use a dialog.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `content` | `ReactNode` | required | The explanation shown in the bubble. Keep it to a sentence or two. |
| `label` | `string` | `'More information'` | Accessible name of the button and of the bubble. Name the subject when there are several on a page: "About effective tokens". |
| `side` | `'top' \| 'right' \| 'bottom' \| 'left'` | `'top'` | Preferred side; flips when there is no room. |
| `className` | `string` | - | Extra classes merged onto the button. |

## Variants

- Button: a 14px help glyph in `fg-subtle` that turns `fg` on hover and while open.
- Bubble: `surface-raised`, `line` border, `shadow-pop`, `text-small`, at most 260px wide.

## Usage

```tsx
import { InfoTip } from '@/components/design-system/atoms/InfoTip/InfoTip';
```

Beside a label:

```tsx
<span className="inline-flex items-center gap-1">
  Effective tokens
  <InfoTip label="About effective tokens" content="Input, output and cache writes. Cache reads do not count toward limits." />
</span>
```

Opening below:

```tsx
<InfoTip side="bottom" content="Estimated equivalent API cost, not a bill." />
```

## a11y

- The trigger is a native `<button>` with `aria-label={label}`, `aria-expanded` and `aria-haspopup="dialog"` from Radix Popover. It opens on click, Enter or Space, so it works on touch, unlike `Tooltip`.
- On open, focus moves into the bubble so screen readers read it; Escape or a click outside closes it and returns focus to the button.
- The button shows the 2px focus ring. The bubble holds no controls, so it draws no ring of its own.

## Notes

- The glyph is 16px square so it lines up with a 12px label; the clickable area extends 4px beyond it on every side (24px).
- The bubble renders in a portal at `z-50`.
- The icon comes straight from `lucide-react`, because an atom cannot import the `Icon` atom.
