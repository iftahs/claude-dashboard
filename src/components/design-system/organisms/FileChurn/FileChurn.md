# FileChurn

**Level:** Organism
**Purpose:** Card that ranks the files edited most often in the window, each with the project it belongs to, a bar and its edit count.

## When to use

- The Code view of the Insights page, beside `YieldPanel`.

## When NOT to use

- Edits grouped by language - use `LanguageBreakdown`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `FileChurnView` | required | The card's view model, built by `buildFileChurn()` in `@/lib/views/insights`. |
| `className` | `string` | - | Extra classes merged onto the card. |

`FileChurnView` fields:

| Field | Type | Description |
|---|---|---|
| `title`, `description`, `help` | `string` | The card header. The description carries the total edits and the number of files. |
| `state` | `SectionState \| null` | Loading, error or empty; null when there are edits to show. |
| `ai` | `SectionAi \| null` | The AI explanation affordance. |
| `rows` | `InsightRankedRow[]` | The top twelve files: the file name, the project as `detail`, the full path as `title`. |

## States

- `loading` - meter skeletons. `error` - the request failed with nothing earlier to show. `empty` - no file was edited in the window.
- Ready - up to twelve rows.

## Usage

```tsx
import { FileChurn } from '@/components/design-system/organisms/FileChurn/FileChurn';
```

```tsx
<FileChurn view={view.churn} />
```

## a11y

- The card is a region named by its title; the list is named "Most-edited files" and every bar is a `role="progressbar"` with its count as text.
- The full path is a hover hint only; the file name and its project are always visible.

## Notes

- Bars are drawn against the most-edited file.
