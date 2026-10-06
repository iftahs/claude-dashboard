# LanguageBreakdown

**Level:** Organism
**Purpose:** Card that ranks the languages the work touched, by file extension: edits and writes as a bar and a count, with reads as a quieter second number.

## When to use

- The Code view of the Insights page, beside `BranchBreakdown`.

## When NOT to use

- The single files edited most - use `FileChurn`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `LanguageBreakdownView` | required | The card's view model, built by `buildLanguages()` in `@/lib/views/insights`. |
| `className` | `string` | - | Extra classes merged onto the card. |

`LanguageBreakdownView` fields:

| Field | Type | Description |
|---|---|---|
| `title`, `description`, `help` | `string` | The card header. |
| `state` | `SectionState \| null` | Loading, error or empty; null when there are edits to show. |
| `ai` | `SectionAi \| null` | The AI explanation affordance. |
| `rows` | `InsightRankedRow[]` | The top ten languages by edits; `secondary` is the read count when above zero. |
| `footnote` | `string` | Says which number is edits and which is reads. |

## States

- `loading` - meter skeletons. `error` - the request failed with nothing earlier to show. `empty` - no file was edited in the window.
- Ready - the list and the footnote.

## Usage

```tsx
import { LanguageBreakdown } from '@/components/design-system/organisms/LanguageBreakdown/LanguageBreakdown';
```

```tsx
<LanguageBreakdown view={view.languages} />
```

## a11y

- The card is a region named by its title; the list is named "Edits by language" and every bar is a `role="progressbar"` with its count as text.
- The read count says "reads" in words, so the dimmed colour is not the only cue.

## Notes

- Bars are drawn against the language with the most edits; reads do not move the bar.
