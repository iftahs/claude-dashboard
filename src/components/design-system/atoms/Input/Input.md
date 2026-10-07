# Input

**Level:** Atom
**Purpose:** Single-line text field outlined in the control border, with an invalid state.

## When to use

- Free text, numbers, keys and search terms typed by the user.
- `sm` inside card headers and dense toolbars.

## When NOT to use

- Choosing from a fixed list - use `Select`.
- A field with a label, helper text or error message - compose a molecule around this atom.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `size` | `'md' \| 'sm'` | `'md'` | 32px or 28px tall. Replaces the native numeric `size` attribute. |
| `invalid` | `boolean` | `false` | Draws the border in `danger` and sets `aria-invalid`. |
| `className` | `string` | - | Extra classes merged onto the input, for example a width. |

Spreads remaining `InputHTMLAttributes<HTMLInputElement>` (except `size`) onto the `<input>` and forwards its ref.

## Variants

- `size`: `md`, `sm`.
- `invalid`: `danger` border.
- `disabled` (native attribute): grey fill and `fg-disabled` text.

The input is full width by default; constrain it with a parent or a width class.

## Usage

```tsx
import { Input } from '@/components/design-system/atoms/Input/Input';
```

Labelled field:

```tsx
<label htmlFor="daily-cap">Daily cap</label>
<Input id="daily-cap" inputMode="decimal" placeholder="60.00" value={cap} onChange={onCapChange} />
```

Invalid state:

```tsx
<Input aria-label="API key" invalid value={apiKey} onChange={onKeyChange} aria-describedby="api-key-error" />
```

## a11y

- Renders a native `<input>` and shows the 2px focus ring on focus.
- `invalid` sets `aria-invalid="true"`; point `aria-describedby` at the error text.
- The consumer must supply a `<label>` or an `aria-label`. A placeholder is not a label.

## Motion

- Border and fill colours ease over 120ms when the invalid or disabled state changes. The focus ring appears at once.
- Under `prefers-reduced-motion` the global rule makes this instant.
