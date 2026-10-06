# SessionTable

**Level:** Organism
**Purpose:** Card with the session history as a paged table: start time, project, title or first prompt, duration and effective tokens per row, where a row opens that session's detail.

## When to use

- The Sessions page, once, under `SessionSearchStrip`. Under Codex the same table lists threads.

## When NOT to use

- Sessions that are running now - use `AgentActivity` or `RunningNow`.
- A ranked breakdown by project - use `ProjectBreakdown`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `SessionTableView` | required | The card's view model from `buildSessionTable()` in `@/lib/views/sessions`, holding only the rows of the page on screen. |
| `onOpen` | `(sessionId: string) => void` | required | Called with a row's session id on click, Enter or Space. |
| `onPageChange` | `(page: number) => void` | required | Called with the page to show by the Previous and Next buttons. |
| `className` | `string` | - | Extra classes merged onto the card. |

`SessionTableView` fields:

| Field | Type | Description |
|---|---|---|
| `title`, `description`, `help` | `string` | The card header: "Session history", "1,204 sessions since Sep 3, 2026". |
| `caption` | `string` | The table's hidden caption. |
| `subject` | `string` | Header of the title column: "Session" or "Thread". |
| `state` | `SectionState \| null` | Loading (table skeleton), error or empty; `null` once there are sessions. |
| `rows` | `SessionRowView[]` | `id`, `started`, `project`, `badge`, `headline`, `headlineKind`, `headlineTitle`, `duration`, `durationTitle`, `durationActive`, `tokens`. |
| `noMatches` | `{ title, description } \| null` | Set when the search filters every session out; replaces the table. |
| `range` | `string` | "Showing 1 to 20 of 1,204 sessions". |
| `page`, `pageCount`, `pageLabel` | `number`, `number`, `string` | The pager: "Page 1 of 61". Hidden when there is one page. |
| `selectedId` | `string \| null` | The session whose detail is open; its row is drawn selected. |

## States

- `loading` - the header and a table skeleton.
- `error` - the header and what failed.
- `empty` - the header and what makes a session appear.
- No matches - an `EmptyState` with the search icon in place of the table.
- Ready - the table and its footer.

## Usage

```tsx
import { SessionTable } from '@/components/design-system/organisms/SessionTable/SessionTable';
```

```tsx
<SessionTable view={page.table} onOpen={page.onOpenSession} onPageChange={page.onPageChange} />
```

## a11y

- A native table with a caption and column headers, inside a `Section` that names the card.
- Every body row is in the tab order and opens on Enter or Space; the focus ring is drawn inside the row.
- The range line is a `role="status"`, so a page change or a new filter result is announced.
- The pager is a `<nav>` named "Pages" with native buttons, disabled at either end.
- Duration keeps the active and wall-clock times in `title`; a session with no turn timing is dimmed and says so there.

## Notes

- Presentational: filtering, paging and row formatting happen in the page hook, which builds view models for one page only, so the DOM stays bounded however long the history is.
- The table is at least 640px wide and scrolls sideways inside its card below that; the page never scrolls sideways.
- The title column takes the free width and truncates with the first prompt in `title`; it is `dir="auto"`. Project names truncate at 192px.
- A titled session shows its title in `fg`, an untitled one its first prompt in quotes in `fg-muted`, and one with neither "No prompt" in `fg-subtle`.

## Private parts

- `SessionTableRow` - one memoised body row with its click and keyboard handling.
