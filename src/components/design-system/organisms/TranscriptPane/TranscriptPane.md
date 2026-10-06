# TranscriptPane

**Level:** Organism
**Purpose:** The messages of one session or thread in order: who spoke and when, the model that answered, the text, and each tool call in a monospace well, with loading, error, archived and empty states.

## When to use

- Inside `SessionDetail`, once its transcript section is opened.
- Any place that shows a `TranscriptView` built by `buildTranscript()` in `@/lib/views/sessions`.

## When NOT to use

- A summary of a session - that is the facts list of `SessionDetail`.
- Live agent activity - use `AgentActivity`.
- Model output from AI insights - use `AiInsightInline`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `TranscriptView` | required | The transcript's view model (see below). |
| `onRetry` | `() => void` | - | Called by the retry button of the error state. Omit it to hide the button. |
| `id` | `string` | - | Id of the root, so the button that opens the pane can point `aria-controls` at it. |
| `className` | `string` | - | Extra classes merged onto the root. |

`TranscriptView` fields:

| Field | Type | Description |
|---|---|---|
| `open` | `boolean` | Whether the consumer shows the pane. Turns are built only while it is true. |
| `count` | `string \| null` | "42 messages", for the consumer's toggle. Null until the transcript is loaded or when it is archived. |
| `status` | `'loading' \| 'error' \| 'archived' \| 'empty' \| 'ready'` | Which state to draw. |
| `message` | `string` | The sentence of the error, archived and empty states. |
| `truncated` | `string \| null` | The note shown above a long transcript whose middle was omitted by the server. |
| `turns` | `TranscriptTurnView[]` | `key`, `user`, `role`, `time`, `model`, `text`, `showText`, `tools` (`key`, `label`, `brief`, `title`). |

## States

- `loading` - text skeleton lines, never the word "Loading".
- `error` - an `ErrorState` with a retry button when `onRetry` is passed.
- `archived` - a neutral `Callout`: the transcript file is gone and only its usage history is kept.
- `empty` - one sentence: no messages were recorded.
- `ready` - an optional warning `Callout` for a truncated transcript, then the turns.

## Usage

```tsx
import { TranscriptPane } from '@/components/design-system/organisms/TranscriptPane/TranscriptPane';
```

```tsx
{transcript.open ? <TranscriptPane id={paneId} view={transcript} onRetry={onRetryTranscript} /> : null}
```

## a11y

- The turns are an `<ol>` named "Transcript", one `<li>` per message, in the order they were written.
- The speaker is written in words ("You", "Agent"); the bot icon is decorative.
- Message text is `dir="auto"`, so a right-to-left prompt reads correctly; the row itself stays left-to-right.
- A tool line keeps its full name and brief in `title`, for when the brief is truncated.

## Notes

- Presentational: it fetches nothing. The page hook asks for the transcript when the pane is opened and passes the state in.
- A message bubble is at most 85% of the pane wide and 288px tall, and scrolls inside itself beyond that. A tool-only turn shows no bubble.
- Tool calls sit in a `surface-sunken` well in `text-code`, one line per call: the tool label, then its brief in `fg-muted`.
- Memoised, with memoised turns: the session facts around it refresh every poll, the transcript does not.

## Private parts

- `TranscriptTurn` - one message: its header line, its text bubble and its tool-call well.
