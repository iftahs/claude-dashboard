# ToastStack

**Level:** Organism
**Purpose:** Stack of toasts pinned to the bottom right of the viewport, oldest on top, each with its own dismiss button and optional action.

## When to use

- Once, at the root of the app, fed by the hook that owns the notification queue.
- Notices that are not tied to one card: a limit crossed a threshold, an update is available, the live connection dropped.

## When NOT to use

- A single notice inside a page - render one `Toast`, or an `ErrorState` in the card that failed.
- A message the reader must answer before going on - use `Dialog`.
- Never keep the queue, the timers or the "do not show again" flags here. They belong to the hook.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `items` | `readonly ToastStackItem[]` | required | The toasts, oldest first. Nothing is rendered when it is empty. |
| `onDismiss` | `(id: string) => void` | required | Called with the toast's `id` when its close button is clicked. |
| `label` | `string` | `'Notifications'` | Accessible name of the region. |

`ToastStackItem`:

| Field | Type | Default | Description |
|---|---|---|---|
| `id` | `string` | required | Unique, stable id; the React key. |
| `tone` | `'info' \| 'success' \| 'warning' \| 'danger'` | required | The toast's tone. |
| `title` | `string` | required | What happened, in sentence case. |
| `description` | `ReactNode` | - | One or two sentences of detail, or richer content such as a command to copy. |
| `action` | `{ label: string; onClick: () => void }` | - | One small secondary button under the text. |
| `dismissible` | `boolean` | `true` | `false` hides the close button. |
| `leaving` | `boolean` | `false` | The toast is on its way out: it slides out and ignores the pointer. |

## Variants

- One look: a column of `Toast` boxes 8px apart, 16px from the bottom and right edges, right aligned.
- The column is never taller than the viewport minus 32px; past that it scrolls.

## Usage

```tsx
import { ToastStack } from '@/components/design-system/organisms/ToastStack/ToastStack';
```

At the app root, wired by the connected component:

```tsx
<ToastStack items={toasts} onDismiss={dismissToast} />
```

The shape of an item with an action:

```tsx
<ToastStack
  onDismiss={onDismiss}
  items={[
    {
      id: 'update',
      tone: 'info',
      title: 'Update available',
      description: 'Version 0.2.1 is ready.',
      action: { label: 'Reload', onClick: onReload },
    },
  ]}
/>
```

## a11y

- The stack is a region named by `label`. Each toast is its own live region: `role="alert"` for `danger`, `role="status"` for the rest.
- A new toast never takes focus. Its close button and action are reached with Tab.
- Only the toasts take pointer events; the gaps between and around them let clicks through to the page.

## Notes

- `position: fixed` at `z-50`. It is rendered in place, not in a portal, so dialogs opened later stack above it.
- It does not time toasts out: auto-dismiss is the hook's decision.

## Motion

- A toast slides in when it joins `items`. An item with `leaving: true` slides out; the owner drops it from `items` once the 160ms are over.
- The remaining toasts close the gap without animation.
- Under `prefers-reduced-motion` the global rule makes this instant.
