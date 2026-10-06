# ModelChip

**Level:** Molecule
**Purpose:** Chip that names a model in its short form with that model's fixed series colour, or a plain "inherit" chip when no model is set.

## When to use

- Naming the model of a session, an agent, a workflow run or a table row.
- Anywhere a raw model id would otherwise be printed: it shortens `claude-opus-5-5` to "opus 5.5" and keeps the full id in `title`.

## When NOT to use

- A chart legend entry - use `Legend` or `LegendDot`.
- A project, branch, tag or effort level - use `Chip`.
- A status - use `Badge`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `model` | `string \| null` | - | The model id as logged: `claude-opus-5-5`, `gpt-5.6-terra`. Empty, missing or `'inherit'` renders a dot-less chip labelled "inherit"; `'unknown'` renders a dot-less chip labelled "unknown". |
| `className` | `string` | - | Extra classes merged onto the chip. |

## Variants

- A model: the 6px dot in `modelColor(model)` and the label from `displayModel(model)`.
- No model (`''`, `null`, `undefined`, `'inherit'`, `'unknown'`): no dot, neutral text.

## Usage

```tsx
import { ModelChip } from '@/components/design-system/molecules/ModelChip/ModelChip';
```

In a row:

```tsx
<ModelChip model={session.model} />
```

An agent that inherits its parent's model:

```tsx
<ModelChip model="inherit" />
```

## a11y

- The dot is decorative; the model name is text, so identity never rests on colour.
- Not interactive and not focusable. The full model id is in `title` whenever a model is set.

## Notes

- Never wraps and never shrinks, like `Chip`; let the neighbouring text truncate.
- The colour is fixed per model by `modelColor()` in `@/lib/palette`, so a model keeps its colour on every page. Do not pass your own colour - use `Chip` for that.
