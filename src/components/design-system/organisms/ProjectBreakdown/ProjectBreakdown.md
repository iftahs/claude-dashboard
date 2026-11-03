# ProjectBreakdown

**Level:** Organism
**Purpose:** Card that ranks projects by estimated cost, active time, tokens or files changed, each with a bar, its session count, an editor for the project's custom tags and an expandable list of its sessions, under the total estimated cost.

## When to use

- The "Projects and tags" view of the Sessions page, beside `TagBreakdown`.

## When NOT to use

- The Cowork surface - its sessions run in a sandbox with no host project, so the page hides this view there.
- Cost by tag - use `TagBreakdown`.
- A ranked list with no editing - use `MeterRow`s in a `Section`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `ProjectBreakdownView` | required | The card's view model from `buildProjectBreakdown()` in `@/lib/views/sessions`. |
| `onSortChange` | `(sort: ProjectSort) => void` | required | Called by the sort control with `'cost'`, `'time'`, `'tokens'` or `'files'`. |
| `onTagsChange` | `(path: string, tags: string[]) => void` | required | Called with a project's path and its full next tag list after an add, a rename or a removal. |
| `onOpenSession` | `(sessionId: string) => void` | required | Called with a session's id when a row of an expanded project is clicked; the page opens `SessionDetail`. |
| `className` | `string` | - | Extra classes merged onto the card. |

`ProjectBreakdownView` fields:

| Field | Type | Description |
|---|---|---|
| `title`, `description`, `help` | `string` | The card header. |
| `state` | `SectionState \| null` | Loading (meter rows), error or empty; `null` when there are projects. |
| `sort` | `ProjectSort` | The selected ranking. |
| `noun` | `'sessions' \| 'threads'` | Names the expand control and its list. |
| `total` | `string \| null` | Estimated cost summed over every project, whatever the sort ("~$15,172"); shown in the header beside the sort control. |
| `rows` | `ProjectRowView[]` | Already sorted: `path`, `name`, `value`, `missing`, `percent`, `count`, `secondary`, `tags`, and the session list: `sessions`, `more`, `partialNote`. |
| `suggestions` | `string[]` | Every tag in use, offered as quick-adds in each row's editor. |

## States

- `loading` - the header and meter-row skeletons; also shown until the cost poll has answered once, so a cost ranking does not flash empty.
- `error` - the header and what failed.
- `empty` - the header and what makes a project appear.
- Ready - the sort control in the header and the list.

## Usage

```tsx
import { ProjectBreakdown } from '@/components/design-system/organisms/ProjectBreakdown/ProjectBreakdown';
```

```tsx
<ProjectBreakdown view={page.projects} onSortChange={page.onProjectSortChange} onTagsChange={page.onProjectTagsChange} />
```

## a11y

- The list is a `<ul>` named "Projects"; each bar is a `role="progressbar"` named by its project, and the value is also written beside the name.
- The sort control is a group named "Sort projects by" with `aria-pressed` segments.
- Each row's tag editor is a group named "Tags for <project>".
- The arrow is named "Show sessions of <project>" and carries `aria-expanded`; the list it opens is named "Sessions in <project>" and each session is a button.

## Notes

- Presentational: sorting, the bar scale and every label come from the view model; tags are stored by the page hook. Whether a project is expanded is UI-only state of its row.
- Cost, tokens and the session count of a row come from the projects endpoint, matched to the session list by full path; the session list only adds active time, files, lines and the lists below. A project with no listed session still has a row, without the expand arrow.
- The arrow is a button with `aria-expanded` on the name row, so the tag editor keeps working. The list shows the 25 costliest sessions with title or first prompt, date, tokens and cost; a row opens that session. A transcript over 64 MB is marked "Large" and explained under the list.
- A project name truncates and keeps its full path in `title`; it is `dir="auto"`. The value never wraps.
- Under the cost ranking a project with no cost reads "No cost data" in `fg-subtle` and has an empty bar.
- The list scrolls inside the card past 560px.
- The bar is relative to the largest project in the selected ranking, not to a total.

## Private parts

- `ProjectBreakdownRow` - one memoised project: name and value, bar, counts and its `TagEditor`, with the expand button.
- `ProjectSessionList` - the expanded list of one project's sessions.
