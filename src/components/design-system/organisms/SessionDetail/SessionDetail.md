# SessionDetail

**Level:** Organism
**Purpose:** Dialog for one session or thread: its title, project and start time, the facts of what it did, its pull requests and tool counts, and its transcript behind a toggle.

## When to use

- The Sessions page, once, opened from a row of `SessionTable` or a hit of `SessionSearchStrip`.

## When NOT to use

- A list of sessions - use `SessionTable`.
- An agent that is running now - that is `AgentActivity` on the Agents page.
- A confirmation or a form - use `Dialog` directly.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `SessionDetailView \| null` | required | The open session's view model from `buildSessionDetail()` in `@/lib/views/sessions`. `null` keeps the dialog closed. |
| `transcript` | `TranscriptView` | required | The transcript's view model from `buildTranscript()`; it carries whether the pane is open and the message count. |
| `onClose` | `() => void` | required | Called on Escape, a click on the overlay or the close button. |
| `onToggleTranscript` | `() => void` | required | Called by the "Transcript" button. The page hook opens the pane and asks for the transcript. |
| `onRetryTranscript` | `() => void` | - | Passed to the transcript's error state as its retry action. |

`SessionDetailView` fields:

| Field | Type | Description |
|---|---|---|
| `id` | `string` | The session id. |
| `title` | `string` | The dialog title: the session title, or the project name when it has none. |
| `project` | `string \| null` | The project name under the title, when the title is not already the project. |
| `badge` | `string \| null` | "Codex" under Both, so a thread is told apart from a session. |
| `started`, `tokens` | `string` | Start time and effective tokens, in monospace under the title. |
| `prompt` | `string \| null` | The first prompt, when it differs from the title. Clamped to two lines. |
| `summaryLabel` | `string` | "Session summary" or "Thread summary". |
| `facts` | `SessionFactView[]` | `key`, `label`, `value`, `tone`, `help`, and `changes` (`files`, `added`, `removed`) for the row that colours added and removed lines. |
| `prs` | `SessionPrView[]` | `url`, `label` ("owner/repo#12") and `href`, which is null for anything that is not an http(s) URL. |
| `tools` | `SessionToolView[]` | `name`, `label`, `count`, most used first. |
| `toolsEmpty` | `string` | The sentence shown when no tool was used. |

## States

- Closed - `view` is `null`; nothing is rendered.
- Open - the facts and tools are on screen at once, because they come with the list.
- Transcript closed - only the toggle, with the message count once the transcript has been loaded.
- Transcript open - `TranscriptPane` with its own loading, error, archived, empty and ready states.

## Usage

```tsx
import { SessionDetail } from '@/components/design-system/organisms/SessionDetail/SessionDetail';
```

```tsx
<SessionDetail
  view={page.detail}
  transcript={page.transcript}
  onClose={page.onCloseSession}
  onToggleTranscript={page.onToggleTranscript}
  onRetryTranscript={page.onRetryTranscript}
/>
```

## a11y

- Built on `Dialog`: focus is trapped while it is open and returns to the row or search hit that opened it.
- The facts are label and value pairs in reading order; added and removed lines carry a plus and a minus sign, so the colours are not the only signal.
- The transcript toggle is a button with `aria-expanded`, and `aria-controls` pointing at the pane while it is open.
- Pull requests are real links that open in a new tab; the full URL is in `title`.

## Notes

- Presentational: the page hook owns which session is open, whether the transcript is shown and the fetch.
- The largest `Dialog` size (720px). The facts and the tools sit side by side from `md` up and stack below.
- A pull request whose URL is not http(s) is shown as plain text, never as a link.
- The dialog title is a plain string, so a right-to-left title keeps left alignment; the project, the first prompt and the transcript text are `dir="auto"`.

## Private parts

- `SessionDetailBody` - the dialog's content: the first prompt, the facts, the pull requests, the tool counts and the transcript section.

## Motion

- Opens and closes with the `Dialog` animation, and keeps showing the session it was closed on until the close animation has ended.
- The transcript fades in (180ms) when it is expanded.
- Under `prefers-reduced-motion` the global rule makes this instant.
