# AiInsightButton

**Level:** Molecule
**Purpose:** Small ghost button with the sparkles icon that asks the model to explain the section it sits on, with a busy state while the answer is on its way.

## When to use

- The header of a card whose data can be explained by AI Insights. `Section` renders it for you from its `ai` prop - reach for this molecule only outside a `Section`.
- Render it only when an AI backend is available. When there is none, leave it out; it has no "unavailable" look.

## When NOT to use

- Inside a `Section` - pass `ai` to the `Section` instead.
- The AI chat on the AI insights page - that is a form with its own send button.
- Any other action - use `Button` or `IconButton`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `onClick` | `() => void` | required | Called when the reader asks for the explanation. |
| `loading` | `boolean` | `false` | The request is in flight: the button is disabled, reads "Thinking" and its icon pulses. |
| `label` | `string` | `'Explain this section with AI'` | The accessible name and the tooltip text. |
| `className` | `string` | - | Extra classes merged onto the button. |

## Variants

- Idle: a 28px ghost `Button` reading "AI" after a 14px sparkles icon.
- Loading: disabled, reading "Thinking", with the icon on `animate-pulse` (still under reduced motion).

## Usage

```tsx
import { AiInsightButton } from '@/components/design-system/molecules/AiInsightButton/AiInsightButton';
```

In a card header that is not a `Section`:

```tsx
<CardHeader title="Model mix" actions={aiAvailable ? <AiInsightButton onClick={onAsk} loading={asking} /> : null} />
```

With its own wording:

```tsx
<AiInsightButton label="Explain this chart with AI" onClick={onAsk} />
```

## a11y

- A native `<button>` whose accessible name is exactly `label` ("Explain this section with AI"). The visible "AI" is contained in that name; "Thinking" is not, and it shows only while the button is disabled.
- While loading it is `disabled` and `aria-busy`, so it cannot be pressed twice.
- The same text shows in a tooltip on hover and on focus. The icon is decorative.

## Notes

- The label changes width between "AI" and "Thinking"; keep it last in a header's actions so nothing to its right moves.
- It never calls a model itself. `onClick` comes from `sectionAi()` in `useAiInsightCtx()`, which also tracks the click.
