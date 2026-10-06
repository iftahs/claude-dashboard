# Kbd

**Level:** Atom
**Purpose:** Shows a keyboard shortcut hint as a small bordered key cap in monospace.

## When to use

- Shortcut hints beside an action or a search field: `Ctrl K`, `Esc`.
- One cap per chord; write the whole chord inside it.

## When NOT to use

- Inline code, paths or model names - use `Markdown` code or a `Chip`.
- Status or counts - use `Badge`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `ReactNode` | - | The key or chord text. |
| `className` | `string` | - | Extra classes merged onto the element. |

Spreads remaining `HTMLAttributes<HTMLElement>` onto the `<kbd>`.

## Usage

```tsx
import { Kbd } from '@/components/design-system/atoms/Kbd/Kbd';
```

A chord:

```tsx
<Kbd>Ctrl K</Kbd>
```

Closing hint:

```tsx
<Kbd>Esc</Kbd>
```

## a11y

- Renders a semantic `<kbd>`; the text is read as written.
- It is a hint only. The shortcut itself is wired by a hook, and the action must stay reachable without it.

## Notes

- 20px tall, never wraps, never shrinks.
