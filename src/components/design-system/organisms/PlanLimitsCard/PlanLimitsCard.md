# PlanLimitsCard

**Level:** Organism
**Purpose:** Card with every rate-limit window one plan reports, each as a meter with its share used and reset time, plus the weekly forecast, the split by surface, gated premium models and the plan name.

## When to use

- The Live usage page: one card for the Claude plan, one for the Codex plan, or one per logged-in Claude account.
- `columns={2}` when the card takes the full width of the page; the default single column when it shares a row.

## When NOT to use

- The current window in detail with tokens, cost and pace - use `LimitGauge`.
- A two-row summary that links to this page - use `LimitGlance`.
- Spending caps in dollars - use `SpendCapsCard`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `PlanLimitsView` | required | The card's view model, built by `buildClaudePlans()` or `buildCodexPlan()` in `@/lib/views/live`. |
| `columns` | `1 \| 2` | `1` | Lays the meters out in one column, or in two from 768px up. |
| `className` | `string` | - | Extra classes merged onto the card. |

`PlanLimitsView` fields:

| Field | Type | Description |
|---|---|---|
| `key` | `string` | Stable id of the card: `claude`, `codex`, or the account key. |
| `platform` | `'claude' \| 'codex'` | Which platform the plan belongs to. |
| `title` | `string` | "Claude plan limits", "Codex plan limits". |
| `account` | `string \| null` | The account's e-mail or label, shown under the title when several accounts are listed. Truncates. |
| `plan` | `string \| null` | Plan badge: "Max 20x", "Pro". Hidden when null. |
| `active` | `boolean` | The account currently signed in: an accent border and an "Active" badge. |
| `help` | `string` | Where the limits come from. |
| `state` | `SectionState \| null` | Loading, or an empty state that says why the limits cannot be read. |
| `rows` | `PlanLimitRowView[]` | One meter per window: `label`, `value`, `percent`, `tone`, `note`, an optional `forecast` and the `surfaces` split. |
| `gates` | `PlanGateView[]` | Premium models the plan gates: `label`, `status`, `tone`. |
| `note` | `string \| null` | Caption under the rows: a snapshot's age, or that the bars are a local estimate. |

## States

- `loading` - two meter skeletons under the real header.
- Unavailable - an empty state with the reason (token expired, limits unavailable).
- Ready - the meters. The weekly row may add a forecast line and, for Claude, a thin bar with a legend that splits the week's usage by surface.

## Usage

```tsx
import { PlanLimitsCard } from '@/components/design-system/organisms/PlanLimitsCard/PlanLimitsCard';
```

One plan across the page:

```tsx
<PlanLimitsCard view={plan} columns={2} />
```

Several cards in a row:

```tsx
<SplitLayout>
  {plans.map((plan) => (
    <PlanLimitsCard key={plan.key} view={plan} />
  ))}
</SplitLayout>
```

## a11y

- The card is a region named by its title.
- Every meter is a `role="progressbar"` named by its window, with the percentage and the reset time as plain text.
- The forecast says its meaning in words and leads with an icon; the surface bar is decorative and its legend names each surface with its share.
- The active account is marked with the word "Active", not only with the border.

## Private parts

- `PlanLimitsRow` - one window: the meter, the forecast line and the surface split.
- `PlanLimitsSurfaces` - the thin stacked bar and legend that split the week's usage by surface.

## Notes

- Tones come from `limitTone()` in `@/lib/limits` for every row, including per-model windows.
- A window the plan does not have is left out instead of drawn at 0%.
- Presentational: reset texts are refreshed by a tick in the page hook.

## Motion

- Each meter grows from zero on mount and glides to a new value (see `ProgressBar`).
- The surface split bar grows from the left once on mount (600ms), and its segments ease their width (320ms).
- Under `prefers-reduced-motion` the global rule makes this instant.
