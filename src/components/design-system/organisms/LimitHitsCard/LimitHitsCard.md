# LimitHitsCard

**Level:** Organism
**Purpose:** Card that counts how often a usage limit blocked work: hits in the last 7 and 30 days, whether one is blocking right now, and the most recent episodes with what was hit and for how long.

## When to use

- The Live usage page, in the Drivers section, for the platform or platforms on screen.

## When NOT to use

- How close the limits are right now - use `LimitGauge` or `PlanLimitsCard`.
- Tool errors and rejections - those belong to the Insights page.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `LimitHitsView` | required | The card's view model, built by `buildLimitHits()` in `@/lib/views/live`. |
| `className` | `string` | - | Extra classes merged onto the card. |

`LimitHitsView` fields:

| Field | Type | Description |
|---|---|---|
| `title` | `string` | "Limit hits", with the platform after it outside Claude. |
| `description` | `string` | The range and the source: "Last 30 days, from local logs". |
| `help` | `string` | What one hit is and what the local logs cannot see. |
| `state` | `SectionState \| null` | Loading or error; null when the counts are in. |
| `blocked` | `boolean` | A limit is blocking right now: adds a "Blocked now" badge to the header. |
| `figures` | `LimitHitsFigureView[]` | Three figures: `label`, `value`, `note`, and `alert` for the one that is blocking. |
| `rows` | `LimitHitRowView[]` | Recent episodes: `kind`, `when`, an optional `model`, an optional `platform` tag under Both, the `status` text and `active` while it still blocks. |

## States

- `loading` - meter skeletons under the real header.
- `error` - the request failed and there is nothing earlier to show.
- No hits - the three figures and one line saying there were none in 30 days.
- Ready - the figures over a list of episodes; an episode that still blocks reads "Lifts in 1h 20m" in the danger colour.

## Usage

```tsx
import { LimitHitsCard } from '@/components/design-system/organisms/LimitHitsCard/LimitHitsCard';
```

```tsx
<LimitHitsCard view={limitHits} />
```

## a11y

- The card is a region named by its title. The figures are a description list; the episodes are a list.
- A blocking limit is said in words in three places (the badge, the "Right now" figure and the row), so the colour is never the only signal.

## Private parts

- `LimitHitsFigure` - one figure: its label, its value and a note.
- `LimitHitsRow` - one episode on two lines: what was hit, with the model and platform, over when it started; the outcome on the right.

## Notes

- A number in brackets after the outcome is how many requests were refused in that episode.
- Presentational: the "lifts in" countdown is refreshed by a tick in the page hook.
