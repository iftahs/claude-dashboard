# Toast

**Level:** Molecule
**Purpose:** Floating notice with a status icon, a title and a sentence, an optional action and a dismiss button.

## When to use

- Something happened that the reader did not ask to see right now: a limit crossed a threshold, an update is available, an export finished.
- `danger` for a failure that needs attention; `warning` for a limit at 70% or more; `success` and `info` for the rest.
- With `action` for the one thing to do next: "Open live usage", "Reload".

## When NOT to use

- A request that failed inside a card - show `ErrorState` in that card.
- Validation of a field - use `FormField` with `error`.
- Information that must stay on screen - put it on the page.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `tone` | `'info' \| 'success' \| 'warning' \| 'danger'` | required | Picks the icon, its colour and the live-region role. |
| `title` | `string` | required | What happened, in sentence case: "Weekly limit at 83%". |
| `description` | `ReactNode` | - | One or two sentences of detail in `text-small` `fg-muted`. |
| `onDismiss` | `() => void` | - | Renders the close button and is called when it is clicked. |
| `action` | `ReactNode` | - | Controls under the text, usually one small `Button`. |
| `dismissLabel` | `string` | `'Dismiss'` | Name and tooltip of the close button. |
| `className` | `string` | - | Extra classes merged onto the box. |

## Variants

- `tone`: `info` (info icon), `success` (check), `warning` and `danger` (alert triangle), each in its `-fg` colour. The box itself stays neutral.
- Box: 340px wide (never wider than its container), `surface-raised`, `line` border, `shadow-pop`, `rounded-card`.

## Usage

```tsx
import { Toast } from '@/components/design-system/molecules/Toast/Toast';
```

A limit warning that can be dismissed:

```tsx
<Toast
  tone="warning"
  title="Weekly limit at 83%"
  description="Resets Monday 01:00. Workflow subagents are the largest share."
  onDismiss={onDismiss}
/>
```

With an action composed by the organism that stacks the toasts:

```tsx
<Toast tone="info" title="Update available" description="Version 0.2.1 is ready." action={reloadButton} onDismiss={onDismiss} />
```

## a11y

- `role="status"` for `info`, `success` and `warning` (announced politely); `role="alert"` for `danger` (announced at once).
- The icon is decorative; the title carries the meaning, so the tone never rests on colour alone.
- The close button is a native `<button>` named by `dismissLabel`, with a tooltip and the 2px focus ring. Controls in `action` keep their own names.
- A toast never steals focus. Do not auto-dismiss one that carries an action the reader needs.

## Notes

- One toast only: stacking, positioning, timing and enter or exit motion belong to the organism and hook that own the queue.
- The title and the description wrap inside the 340px box.
