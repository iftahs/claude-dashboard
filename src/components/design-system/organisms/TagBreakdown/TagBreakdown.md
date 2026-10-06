# TagBreakdown

**Level:** Organism
**Purpose:** Card that splits estimated cost by the custom tags given to projects: a donut of the shares over a list with each tag's cost, share and tokens, with untagged projects as their own entry.

## When to use

- The "Projects and tags" view of the Sessions page, beside `ProjectBreakdown`, where the tags are assigned.

## When NOT to use

- Cost by project - use `ProjectBreakdown`.
- Cost by model or over time - those are charts on the Models and Trends pages.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `TagBreakdownView` | required | The card's view model from `buildTagBreakdown()` in `@/lib/views/sessions`. |
| `className` | `string` | - | Extra classes merged onto the card. |

`TagBreakdownView` fields:

| Field | Type | Description |
|---|---|---|
| `title`, `description`, `help` | `string` | The card header. |
| `chartLabel` | `string` | Accessible name of the donut. |
| `state` | `SectionState \| null` | Loading, error, or empty while no project has a tag; `null` otherwise. |
| `groups` | `TagGroupView[]` | One per tag, most expensive first, "Untagged" last: `key`, `label`, `color`, `cost`, `share`, `tokens`. `cost` is `null` when the tag has no cost. |
| `slices` | `TagSliceView[]` | The groups that have a cost, for the donut: `key`, `label`, `color`, `value`, `valueLabel`. |

## States

- `loading` - the header and a chart skeleton.
- `error` - the header and what failed.
- `empty` - the header and a sentence saying where to add a tag.
- Ready - the donut when at least one tag has a cost, and the list in every case.

## Usage

```tsx
import { TagBreakdown } from '@/components/design-system/organisms/TagBreakdown/TagBreakdown';
```

```tsx
<TagBreakdown view={page.tags} />
```

## a11y

- The donut is a `role="img"` named by `chartLabel`; every number it shows is also in the list under it.
- The list is the chart's legend: each tag is named in words beside its swatch, so a tag is never identified by colour alone.

## Notes

- Presentational: the grouping, the colours and the labels come from the view model. Tag colours are `tagColor()`; the untagged entry uses the `tag-untagged` token.
- A project with several tags counts toward each, so the shares describe attribution, not a partition of one total.
- Slices are separated by a small gap instead of a stroke, and the donut does not animate.
- The hover read-out is a `ChartTooltip`. A tag name truncates in the list with its full text in `title`; the numbers never wrap.
- Memoised: the view model changes only when the sessions, the costs or the tags do.

## Private parts

- `TagBreakdownTooltip` - adapts Recharts' hovered slice to `ChartTooltip`.
