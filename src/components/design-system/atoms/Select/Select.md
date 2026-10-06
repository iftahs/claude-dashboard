# Select

**Level:** Atom
**Purpose:** Dropdown that picks one value from a short list of options, with a trigger styled like an input.

## When to use

- Choosing one of roughly four or more fixed options: a model, a week start, a provider.
- `sm` inside card headers and toolbars.

## When NOT to use

- Two to four always-visible choices such as a range or a platform - use a segmented control.
- Free text or search - use `Input`.
- A menu of actions - use a dropdown menu.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `value` | `string` | - | The selected option's `value`. `undefined` or `''` shows the placeholder. |
| `onValueChange` | `(value: string) => void` | required | Called with the picked option's `value`. |
| `options` | `{ value: string; label: string }[]` | required | The choices, in display order. A `value` must be unique and not empty. |
| `ariaLabel` | `string` | required | Accessible name of the trigger. |
| `placeholder` | `string` | - | Shown in `fg-subtle` while no value is selected. |
| `size` | `'md' \| 'sm'` | `'md'` | 32px or 28px tall trigger and items. |
| `disabled` | `boolean` | `false` | Disables the trigger. |
| `id` | `string` | - | Id of the trigger, so a `<label htmlFor>` can point at it. |
| `className` | `string` | - | Extra classes merged onto the trigger, usually a width such as `w-56` or `w-full`. |

## Variants

- `size`: `md`, `sm`.
- The trigger is as wide as its content by default.
- The list floats on `surface-raised` with `shadow-pop`, is at least as wide as the trigger, highlights the hovered or keyboard-focused item with `surface-hover`, and marks the selected item with a check.

## Usage

```tsx
import { Select } from '@/components/design-system/atoms/Select/Select';
```

Controlled, fixed width:

```tsx
<Select
  ariaLabel="Week starts on"
  className="w-56"
  value={weekStart}
  onValueChange={onWeekStartChange}
  options={[
    { value: 'monday', label: 'Week starts Monday' },
    { value: 'sunday', label: 'Week starts Sunday' },
  ]}
/>
```

With a placeholder, small:

```tsx
<Select ariaLabel="Model" size="sm" placeholder="Any model" value={model} onValueChange={onModelChange} options={modelOptions} />
```

## a11y

- Built on Radix Select: the trigger is a `combobox` button, the list a `listbox`; arrow keys, Home, End, typeahead, Enter and Escape work, and focus returns to the trigger on close.
- The trigger shows the 2px focus ring; inside the list the highlighted item is the focus indicator.
- `ariaLabel` is always required, even when a visible label is linked through `id`.

## Notes

- Controlled only: the consumer owns `value` and updates it in `onValueChange`.
- An option `value` of `''` is not allowed by Radix (it means "no selection"); use a sentinel such as `'all'`.
- The list renders in a portal at `z-50`, outside the app shell, so it sets its own `text-body`, `fg` and tabular numerals.

## Motion

- The trigger's colours ease over 120ms. The list scales in from the trigger (160ms) and out (120ms) through Radix `data-state`.
- Highlighted options change at once, so keyboard movement is never delayed.
- Under `prefers-reduced-motion` the global rule makes this instant.
