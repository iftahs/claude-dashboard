# Chip

**Level:** Atom
**Purpose:** Compact monospace tag for a model, project or other identifier, with an optional colour dot.

## When to use

- Naming a model, a project tag, a branch or an effort level inside rows and card headers.
- With `color` when the identifier has a data colour, such as a model's series colour.

## When NOT to use

- Status or counts - use `Badge`.
- Something clickable or removable - a chip is a static label.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `ReactNode` | - | The identifier text. |
| `color` | `string` | - | Any CSS colour, drawn as a 6px dot before the text, for example the string returned by `modelColor()`. Omit for no dot. |
| `className` | `string` | - | Extra classes merged onto the chip. |

Spreads remaining `HTMLAttributes<HTMLSpanElement>` (except the legacy `color` attribute) onto the `<span>`.

## Usage

```tsx
import { Chip } from '@/components/design-system/atoms/Chip/Chip';
```

A model with its series colour:

```tsx
<Chip color={modelColor(model)}>opus 5.5</Chip>
```

Plain identifier:

```tsx
<Chip>inherit</Chip>
```

## a11y

- The dot is `aria-hidden`; the text carries the meaning, so the colour is never the only signal.
- Not interactive and not focusable.

## Notes

- 22px tall, hairline border, 12px monospace in `fg-muted`.
- Never wraps and never shrinks (`whitespace-nowrap flex-none`); let the neighbouring text truncate instead.
- `color` is applied through an inline style, so pass a token value (`rgb(var(--model-opus-1))`), not a raw hex.
