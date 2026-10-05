# KeyValueRow

**Level:** Molecule
**Purpose:** One fact on a line: a muted label on the left and its value in monospace on the right, with an optional help popover and a status tone for the value.

## When to use

- A short list of facts in a card or a detail panel: "Effective tokens 12.4M tok", "Est. cost ~$18.20".
- `help` when the label uses a term that needs a sentence.
- `tone` when the value itself is good, bad or highlighted.

## When NOT to use

- A value against a limit - use `MeterRow`.
- One headline number - use `StatTile`.
- Many rows with several columns - use `Table`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `label` | `string` | required | What the value is, in sentence case. Truncates with its full text in `title`. |
| `value` | `ReactNode` | required | The formatted value. Never wraps and never shrinks. |
| `help` | `ReactNode` | - | Explanation shown in an `InfoTip` after the label. |
| `tone` | `'default' \| 'muted' \| 'success' \| 'warning' \| 'danger' \| 'accent'` | `'default'` | Colour of the value. |
| `className` | `string` | - | Extra classes merged onto the row. |

## Variants

- `tone`: `default` (`fg`), `muted` (`fg-muted`), `success`, `warning`, `danger` and `accent` (the tone's `-fg`). The tone colours the value only.

## Usage

```tsx
import { KeyValueRow } from '@/components/design-system/molecules/KeyValueRow/KeyValueRow';
```

A list of facts (the stack is composed by the organism):

```tsx
<div className="flex flex-col gap-2">
  <KeyValueRow label="Effective tokens" value="12.4M tok" help="Input, output and cache writes. Cache reads do not count toward limits." />
  <KeyValueRow label="Est. cost" value="~$18.20" />
  <KeyValueRow label="Projected at reset" value="71%" tone="warning" />
</div>
```

A single row with a quiet value:

```tsx
<KeyValueRow label="Last run" value="2h ago" tone="muted" />
```

## a11y

- Label and value are plain text in reading order; the tone is never the only signal, so say it in words when it matters ("71%, above the warning line").
- The help button is an `InfoTip` named "About" plus the label.

## Notes

- Label in `text-small`, `fg-muted`; value in 12px monospace. The two sit on one baseline with at least 12px between them.
- It has no vertical spacing of its own: stack rows with `flex flex-col gap-2`.
