# AiInsightInline

**Level:** Molecule
**Purpose:** Result block for an AI explanation under a card's content: a label with the backend that answered, a dismiss button, and the answer as markdown, as skeleton lines while it loads or as an error message.

## When to use

- Under the content of a card after the reader asked for an AI explanation. `Section` renders it for you from `ai.result`.
- From the moment the request starts (`loading`), so the reader sees where the answer will land.

## When NOT to use

- Inside a `Section` - pass `ai` to the `Section` instead.
- The conversation on the AI insights page - that is a chat transcript.
- A notice that is not model output - use `Callout`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `onDismiss` | `() => void` | required | Called by the dismiss button; the consumer removes the block. |
| `text` | `string` | - | The answer, rendered with `Markdown`. |
| `loading` | `boolean` | `false` | Shows three skeleton lines instead of the answer. |
| `error` | `string` | - | Shown in `danger-fg` instead of the answer. Wins over `text`; `loading` wins over both. |
| `backendLabel` | `string` | - | Quiet note after the label: "via claude -p", "via Claude.ai", "via API key". |
| `className` | `string` | - | Extra classes merged onto the root, for example `mt-4`. |

## States

- `loading` - three 8px skeleton lines, the last one shorter.
- `error` - one line of `text-small` in `danger-fg`.
- Ready - the answer as markdown in `text-body`, `fg-muted` with `fg` headings and emphasis.

## Usage

```tsx
import { AiInsightInline } from '@/components/design-system/molecules/AiInsightInline/AiInsightInline';
```

Under a card's content:

```tsx
<AiInsightInline className="mt-4" text={insight} backendLabel="via claude -p" onDismiss={onDismiss} />
```

While the request is in flight, and after it failed:

```tsx
<AiInsightInline loading onDismiss={onDismiss} />
<AiInsightInline error="The model did not answer. Try again in a minute." onDismiss={onDismiss} />
```

## a11y

- The body is an `aria-live="polite"` region marked `aria-busy` while loading, so the answer or the error is announced when it arrives. Screen readers hear "Analyzing this section" in the meantime.
- The dismiss button is an `IconButton` named "Dismiss AI insight" with a "Dismiss" tooltip.
- The sparkles icon is decorative; the words "AI insight" carry the meaning.

## Notes

- A `surface-sunken` well with a hairline border and `rounded-control`: calm on purpose, never an accent fill.
- It has no outer margin; the consumer spaces it from the content above.
- `backendLabel` is plain text. Map a backend to its label with `aiBackendLabel()` from `@/lib/section` in the hook, not here.
- Model output is rendered through `Markdown`, never as raw HTML.
