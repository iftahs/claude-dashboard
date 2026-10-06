# SessionSearchStrip

**Level:** Organism
**Purpose:** Search field for the session history with the transcript matches listed under it: each hit names its session, project, date and match count over one line of the matching text, and opens that session.

## When to use

- The Sessions page, above `SessionTable`: the same query filters the table and searches transcript text.

## When NOT to use

- A search with no result list of its own - use `Input` with a search icon.
- The command palette - use `CommandPalette`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `SessionSearchView` | required | The field's value and the result state, from `buildSessionSearch()` in `@/lib/views/sessions`. |
| `onQueryChange` | `(query: string) => void` | required | Called on every keystroke and with `''` by the clear button. The page hook debounces the request. |
| `onOpen` | `(sessionId: string) => void` | required | Called with a hit's session id when it is clicked. |
| `className` | `string` | - | Extra classes merged onto the root. |

`SessionSearchView` fields:

| Field | Type | Description |
|---|---|---|
| `query` | `string` | The field's value. |
| `label`, `placeholder` | `string` | The field's accessible name and its placeholder. |
| `status` | `'idle' \| 'loading' \| 'error' \| 'empty' \| 'ready'` | `idle` below three characters: only the field shows. |
| `summary` | `string` | "Found in 3 session transcripts", the no-match sentence or the error. |
| `hits` | `SearchHitView[]` | `id`, `headline`, `project`, `badge`, `date`, `matches`, `snippet`. At most eight. |

## States

- `idle` - the field alone.
- `loading` - a card with two skeleton lines while the debounced request is in flight.
- `error` - a danger `Callout`.
- `empty` - a neutral `Callout` naming the query that matched nothing.
- `ready` - a card with the summary line and one button per hit.

## Usage

```tsx
import { SessionSearchStrip } from '@/components/design-system/organisms/SessionSearchStrip/SessionSearchStrip';
```

```tsx
<SessionSearchStrip view={page.search} onQueryChange={page.onSearchChange} onOpen={page.onOpenSession} />
```

## a11y

- The root is a `role="search"` landmark; the field is named by `view.label`.
- The summary is a `role="status"`, so the number of matches is announced when it arrives; the error is a `role="alert"`.
- Each hit is a native `<button>` with the 2px focus ring drawn inside the card.
- The clear button is named "Clear search" and returns focus to the field.

## Notes

- Presentational: it runs no request. The page hook owns the query, the debounce and the fetch.
- Titles, project names and snippets truncate to one line and are `dir="auto"`; the date and the match count never wrap.
- The field stays in place while results come and go, so typing is never interrupted by a layout shift above it.
