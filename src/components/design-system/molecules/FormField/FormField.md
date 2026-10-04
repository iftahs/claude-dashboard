# FormField

**Level:** Molecule
**Purpose:** Wraps one form control with its label and a helper line that an error message replaces.

## When to use

- Every labelled control in a form or a settings section: an `Input`, a `Select`, a native `<textarea>`.
- `error` when validation fails; `helper` for the format or the consequence of the value.

## When NOT to use

- A control whose name is obvious from an icon or its placeholder position, such as a search box in a toolbar - give that control an `aria-label` instead.
- A group of checkboxes or radios - use a `<fieldset>` with a `<legend>`.
- Showing a value that cannot be edited - use a label and value row.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `label` | `string` | required | Visible label, in sentence case. |
| `htmlFor` | `string` | required | Id of the control. Also the base of the message ids. |
| `children` | `ReactElement` | required | The control: exactly one element, usually an `Input` or a `Select`. |
| `helper` | `ReactNode` | - | Supporting line under the control in `text-caption`, `fg-subtle`. |
| `error` | `ReactNode` | - | Error line in `danger-fg`. Replaces `helper` while present. |
| `required` | `boolean` | `false` | Adds a `*` after the label and sets `required` on the control. |
| `className` | `string` | - | Extra classes merged onto the root, usually a width such as `w-56`. |

## Variants

- Default: label, control, optional helper.
- Error: the helper is replaced by the error line in `danger-fg`. The control's own red border comes from its `invalid` prop, which the consumer passes.
- Required: a `*` in `danger-fg` after the label.

## Usage

```tsx
import { FormField } from '@/components/design-system/molecules/FormField/FormField';
```

With a helper line:

```tsx
<FormField label="Daily cap" htmlFor="daily-cap" helper="In US dollars. Leave empty for no cap.">
  <Input inputMode="decimal" placeholder="60.00" value={cap} onChange={onCapChange} />
</FormField>
```

With an error:

```tsx
<FormField label="API key" htmlFor="api-key" error={keyError} required>
  <Input invalid={Boolean(keyError)} value={apiKey} onChange={onKeyChange} />
</FormField>
```

## a11y

- The `<label>` points at the control through `htmlFor`. If the control has no `id`, the field gives it `id={htmlFor}`.
- The visible message gets the id `<htmlFor>-error` or `<htmlFor>-helper`, and that id is added to the control's `aria-describedby` (after any ids it already has).
- With `error`, the control gets `aria-invalid="true"` unless it sets `aria-invalid` itself. With `required`, it gets the native `required` attribute; the `*` is `aria-hidden`.
- The error line is not a live region: it is read when focus reaches the control. After a failed submit, move focus to the first invalid control in the form's hook.

## Notes

- These attributes are injected into the child with `cloneElement`, so the child must be a single element that passes unknown props to its control. `Input` and native controls do; `Select` takes the `id` and ignores the rest, so its `ariaLabel` stays the source of its name.
- 6px between the label, the control and the message. The field is as wide as its container.
