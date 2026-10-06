# SettingRow

**Level:** Atom
**Purpose:** One setting inside a settings card: its name and a sentence of explanation beside the control that changes it, with room for extra content underneath.

## When to use

- Each setting of a settings section: a name, what it changes, and its `SegmentedControl`, `Checkbox`, `Button` or value.
- `layout="stacked"` when the control needs the full width, such as a group of form fields.
- `below` for content that belongs to the setting but is too wide for the control column: a status line, a list of checkboxes, an error.

## When NOT to use

- A labelled text field or select on its own - use `FormField`.
- A read-only fact in a list of facts - use `KeyValueRow`.
- The title of the card itself - use `Section` or `CardHeader`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `title` | `string` | required | The setting's name, in sentence case. Rendered as an `<h3>`. |
| `description` | `ReactNode` | - | What the setting changes, in `text-caption` `fg-muted`. |
| `children` | `ReactNode` | - | The control. Right of the text from `md` up, under it below `md`. |
| `below` | `ReactNode` | - | Full-width content under the row. |
| `layout` | `'inline' \| 'stacked'` | `'inline'` | `inline` puts the control beside the text from `md` up; `stacked` always puts it underneath at full width. |
| `className` | `string` | - | Extra classes merged onto the root. |

## Variants

- `inline`: from `md` (768px) up the text takes the free width, at most 576px, and the control keeps its own width on the right. Below `md` the control sits under the text, left aligned.
- `stacked`: the control is always under the text and as wide as the row.

## Usage

```tsx
import { SettingRow } from '@/components/design-system/atoms/SettingRow/SettingRow';
```

Rows of one settings card, separated by hairlines (the stack is composed by the organism):

```tsx
<div className="flex flex-col divide-y divide-line">
  <SettingRow title="Week start" description="First day of the week for the weekly spending window.">
    {weekStartControl}
  </SettingRow>
  <SettingRow title="Theme" description="Dark or light.">
    {themeControl}
  </SettingRow>
</div>
```

With content underneath:

```tsx
<SettingRow title="Limit alerts" description={limitDescription} below={thresholdCheckboxes}>
  {limitModeControl}
</SettingRow>
```

## a11y

- The title is a real `<h3>`, so the settings of a card appear in the heading outline under the card's `<h2>`.
- The row does not label its control: give the control its own accessible name (`ariaLabel` on a `SegmentedControl`, `aria-labelledby` on a group of checkboxes).
- Reading and focus order follow the DOM: title, description, control, then `below`.

## Notes

- It imports no design-system component and only arranges the nodes it is given, so it is an atom.
- Each row has 16px of padding above and below; the first and last row of a stack drop the outer one, so the stack lines up with the card's own padding. Separate rows with `divide-y divide-line` on the parent.
