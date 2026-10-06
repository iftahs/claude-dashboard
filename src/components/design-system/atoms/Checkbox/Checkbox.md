# Checkbox

**Level:** Atom
**Purpose:** Labelled box that switches one setting on or off, or picks one of several independent choices.

## When to use

- A single on/off setting: "Disable anonymous analytics".
- Several choices where any number can be picked, such as alert thresholds - put them in a `role="group"` named by a visible label.

## When NOT to use

- Exactly one of two to five options - use `SegmentedControl`.
- One of many options - use `Select`.
- An action that happens at once - use `Button`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `checked` | `boolean` | required | Whether the box is ticked. |
| `onCheckedChange` | `(checked: boolean) => void` | required | Called with the new state when the reader clicks the box or its label. |
| `children` | `ReactNode` | required | The label, in sentence case. It is part of the click target. |
| `disabled` | `boolean` | `false` | Greys out the box and the label and ignores clicks. |
| `className` | `string` | - | Extra classes merged onto the label element. |

Spreads remaining `InputHTMLAttributes<HTMLInputElement>` (except `type`, `checked`, `onChange` and `children`) onto the `<input>`, for example `id` or `aria-describedby`.

## Variants

- Unchecked: a 16px box on `surface` outlined in `line-control`.
- Checked: `accent` fill with a check in `fg-on-accent`.
- Disabled: `surface-hover` fill, `line` border, label in `fg-disabled`.

## Usage

```tsx
import { Checkbox } from '@/components/design-system/atoms/Checkbox/Checkbox';
```

One setting:

```tsx
<Checkbox checked={optOut} onCheckedChange={onOptOutChange}>
  Disable anonymous analytics
</Checkbox>
```

A group of independent choices:

```tsx
<div role="group" aria-labelledby={labelId} className="flex flex-wrap items-center gap-x-4 gap-y-2">
  <span id={labelId}>Alert at</span>
  {thresholds.map((threshold) => (
    <Checkbox key={threshold.value} checked={threshold.checked} disabled={off} onCheckedChange={() => onToggle(threshold.value)}>
      {threshold.label}
    </Checkbox>
  ))}
</div>
```

## a11y

- Renders a native `<input type="checkbox">` inside its `<label>`, so the label names it and clicking the text toggles it. Space toggles it from the keyboard.
- The box shows the 2px focus ring. The check glyph is decorative.
- The state is carried by the native `checked` property, not by colour alone.

## Notes

- Controlled only: the consumer owns `checked`.
- The check glyph comes straight from `lucide-react`, because an atom cannot import the `Icon` atom.
- The label text wraps; the box never shrinks.

## Motion

- The box eases its border and fill over 120ms when it is checked or disabled.
- Under `prefers-reduced-motion` the global rule makes this instant.
