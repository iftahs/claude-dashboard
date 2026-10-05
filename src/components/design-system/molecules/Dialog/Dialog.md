# Dialog

**Level:** Molecule
**Purpose:** Modal panel over a dimmed page with a title, a scrolling body, an optional footer of actions and a close button.

## When to use

- A task that must be finished or cancelled before going on: confirming a destructive action, editing a setting, starting an export.
- Detail that is too large for a popover and belongs to the current page, such as a run's full breakdown.
- `footer` for the actions: one `primary` or `danger` button and a `ghost` or `secondary` cancel.

## When NOT to use

- A sentence of explanation - use `InfoTip`.
- A short list of actions on one item - use `DropdownMenu`.
- A notice that needs no answer - use `Toast`.
- A whole page of content - navigate to a page.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `open` | `boolean` | required | Whether the dialog is shown. |
| `onOpenChange` | `(open: boolean) => void` | required | Called with `false` when the reader presses Escape, clicks the overlay or the close button. |
| `title` | `string` | required | The dialog's heading and accessible name, in sentence case. |
| `description` | `ReactNode` | - | One line under the title in `text-small` `fg-muted`; also the dialog's accessible description. |
| `children` | `ReactNode` | - | The body. It scrolls when it is taller than the viewport allows. |
| `footer` | `ReactNode` | - | Actions, right aligned above a hairline, 8px apart. |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Maximum width: 400px, 520px or 720px. |
| `closeLabel` | `string` | `'Close'` | Accessible name of the close button. |

## Variants

- `size`: `sm` (confirmations), `md` (forms), `lg` (detail views). Every size keeps 16px clear of the viewport edges and is never taller than the viewport minus 32px.
- Panel: `surface-raised`, `line` border, `shadow-pop`, `rounded-dialog`, 20px padding. Overlay: `bg-overlay`.

## Usage

```tsx
import { Dialog } from '@/components/design-system/molecules/Dialog/Dialog';
```

Confirming a destructive action (the buttons are composed by the organism):

```tsx
<Dialog
  open={confirming}
  onOpenChange={setConfirming}
  size="sm"
  title="Forget archived history"
  description="This removes usage from transcripts Claude Code has already deleted. It cannot be undone."
  footer={confirmButtons}
/>
```

A form:

```tsx
<Dialog open={editing} onOpenChange={setEditing} title="Spending caps" footer={saveButtons}>
  {capFields}
</Dialog>
```

## a11y

- Built on Radix Dialog: `role="dialog"`, named by the title and described by the description when there is one. While it is open the rest of the page is hidden from assistive tech.
- Focus is trapped inside while it is open, moves to the first focusable element on open (the close button, unless the body or footer sets `autoFocus`), and returns on close to the element that had focus when it opened, normally the button that opened it.
- Escape and a click on the overlay close it through `onOpenChange(false)`. The page behind is inert and does not scroll.
- The close button is a native `<button>` named by `closeLabel`. It has no tooltip, because focus lands on it when the dialog opens and the tooltip would open every time.

## Notes

- Controlled only: the consumer owns `open` and renders the element that opens it.
- Renders in a portal at `z-50`; popovers, selects and menus opened from inside it stack above it. The portal is outside the app shell, so the panel sets its own `text-body`, `fg` and tabular numerals.
- Centred with auto margins, not a transform, so the panel sits on whole pixels and its text stays sharp.
- It does not animate.
