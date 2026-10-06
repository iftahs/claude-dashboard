# ErrorState

**Level:** Molecule
**Purpose:** Centred alert that says what failed and what to do, with an optional retry button.

## When to use

- A card or a page whose request failed and has no data to show.
- With `onRetry` whenever trying again can help.

## When NOT to use

- Stale data that is still worth showing - keep the content and add a note.
- A validation error on one control - use `FormField` with `error`.
- A transient notice - use `Toast`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `title` | `string` | required | What failed, in sentence case: "Could not load limit hits". |
| `description` | `ReactNode` | - | Why, and what to do: "The server did not answer. Showing nothing rather than stale data." |
| `detail` | `string` | - | Technical text such as an error message, shown collapsed under a "Technical details" disclosure. |
| `onRetry` | `() => void` | - | Renders a small secondary button with the refresh icon that calls it. |
| `retryLabel` | `string` | `'Try again'` | Text of the retry button. |
| `className` | `string` | - | Extra classes merged onto the root, for example `py-6` in a short card. |

## Variants

- One look: a `danger-fg` alert icon, the title in `text-body` medium, the description in `text-small` `fg-muted`, 8px apart, centred with 48px above and below.
- The retry button renders only when `onRetry` is passed.
- With `detail`, a closed "Technical details" disclosure sits last, so opening it never moves the button; the text is mono, wraps, and scrolls past 160px.

## Usage

```tsx
import { ErrorState } from '@/components/design-system/molecules/ErrorState/ErrorState';
```

Inside a card, with retry:

```tsx
<Card>
  <ErrorState
    title="Could not load limit hits"
    description="The server did not answer. Showing nothing rather than stale data."
    onRetry={refetch}
  />
</Card>
```

Nothing to retry:

```tsx
<ErrorState title="Codex is not set up" description="Sign in to the ChatGPT desktop app and this page fills in." />
```

A caught render error, with the message as collapsed detail:

```tsx
<ErrorState
  title="This page hit an error"
  description="Reloading usually fixes it."
  detail={String(error)}
  onRetry={reload}
  retryLabel="Reload page"
/>
```

## a11y

- `role="alert"`: the title and the description are announced when the state appears.
- The detail is a native `<details>`/`<summary>`, so it toggles with Enter and Space; its scrollable text is focusable for keyboard scrolling.
- The icon is decorative; the words carry the error, so it never rests on the danger colour alone.
- The retry button is a native `<button>` with a visible label and the 2px focus ring.

## Notes

- It has no card of its own: place it inside the `Card` whose content failed.
- It never retries by itself. `onRetry` comes from the hook that owns the request.
