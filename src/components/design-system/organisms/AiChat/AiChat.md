# AiChat

**Level:** Organism
**Purpose:** Chat surface for asking questions about usage: a scrolling list of questions and markdown answers, suggested questions, and a composer pinned to the bottom of the card.

## When to use

- The AI insights page, once, as the only child after the page header in a `PageLayout`. It takes `flex-1`, so it fills the height left under the header and only the messages scroll.

## When NOT to use

- A one-off explanation of a single card - use the `ai` prop of `Section`.
- Showing model output that is not a conversation - use `AiInsightInline` or `Markdown`.
- Inside a container with no height of its own and no `flex` column parent - the card would fall back to its 384px minimum.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `AiChatView` | required | The conversation and its suggestions, built by the page hook (types in `@/lib/views/ai`). |
| `onAsk` | `(question: string) => void` | required | Called with the typed question or the clicked suggestion. Not called for an empty question or while an answer is on its way. |
| `onNavigate` | `(event, href) => void` | - | Called when the setup link is clicked, so the consumer can route without a page load. |
| `className` | `string` | - | Extra classes merged onto the card. |

`AiChatView` fields:

| Field | Type | Description |
|---|---|---|
| `setup` | `AiSetupView \| null` | When set, no AI backend is available: the card shows `title`, `description` and a link (`linkLabel`, `href`) instead of the chat. |
| `messages` | `AiChatMessageView[]` | `id`, `role`, `content`, `error` and `datasets`, oldest first. |
| `loading` | `boolean` | An answer is being written: suggestions and Send are disabled. |
| `starters` | `string[]` | Questions offered before the first message, and after it while there are no follow-ups. |
| `followUps` | `string[]` | Questions suggested by the model after an answer. |
| `contextHref` | `string` | Link to the data the chat sends to the model. Opens in a new tab. |

## States

- Setup (`view.setup`) - an `EmptyState` with the reason and a link to the AI settings.
- Empty conversation - a centred prompt with the starter questions as buttons.
- Conversation - questions on the right, answers on the left. An answer with no text yet reads "Thinking" beside a pulsing dot; a failed one is a `danger` bubble with the error text; a finished one is markdown, followed by the datasets it was answered from.
- While `loading`, the suggestion buttons and Send are disabled; the field stays editable.

## Usage

```tsx
import { AiChat } from '@/components/design-system/organisms/AiChat/AiChat';
```

```tsx
<PageLayout width="full" header={<PageHeader description={description} actions={actions} />}>
  <AiChat view={chat} onAsk={onAsk} onNavigate={onNavigate} />
</PageLayout>
```

## a11y

- The message list is a `role="log"` region, so new answers are announced politely; once it holds messages it is focusable, so it can be scrolled from the keyboard.
- A failed answer is a `role="alert"`.
- The composer is a real `<form>`: Enter sends. The field is named "Ask about your usage"; a placeholder alone is not a label.
- Suggestions are native buttons; a truncated one keeps its full text in `title`.

## Private parts

- `AiChatMessage` - one question or answer bubble with its pending, error and markdown states.

## Notes

- Layout: the card is `relative flex-1` with a 384px minimum height and its content is positioned over it, so the messages can scroll without every ancestor having to opt out of its content height. The page itself does not scroll while the viewport is taller than the header plus that minimum.
- The list scrolls to its end whenever a message arrives or grows, and again when the follow-up suggestions change the height of the footer.
- UI-only state: the draft in the field. The conversation, the suggestions and the request belong to the page hook.
- Bubbles are at most 768px or 85% of the card wide, whichever is smaller.
