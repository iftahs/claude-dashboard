# SpendCapsCard

**Level:** Organism
**Purpose:** Card that sets today's, this week's and this month's spend against the spending caps from Settings, one meter per capped period.

## When to use

- The Live usage page, last section: shown when a cap is set, and always in pay-as-you-go mode, where the spend is the bill.

## When NOT to use

- Plan rate limits in percent - use `PlanLimitsCard`.
- Editing the caps - that is the Settings page.
- Today's spend with its trend - use `SpendToday`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `SpendCapsView` | required | The card's view model, built by `buildSpendCaps()` in `@/lib/views/live`. |
| `className` | `string` | - | Extra classes merged onto the card. |

`SpendCapsView` fields:

| Field | Type | Description |
|---|---|---|
| `title` | `string` | "Spend vs caps", with the platform after it outside Claude. |
| `description` | `string` | Whether the spend is estimated from local logs or billed by a gateway. |
| `help` | `string` | What the figures are and where the caps are stored. |
| `state` | `SectionState \| null` | Loading or error; null when the periods are in. |
| `rows` | `LimitCapView[]` | One row per period: `label`, `value`, `percent`, `tone`, `note`. A null `percent` is a period with no cap. |

## States

- `loading` - meter skeletons under the real header.
- `error` - the request failed and there is nothing earlier to show.
- Ready - a meter per capped period with when it resets; a period with no cap is a value line that says "No cap set".

## Usage

```tsx
import { SpendCapsCard } from '@/components/design-system/organisms/SpendCapsCard/SpendCapsCard';
```

```tsx
{spendCaps ? <SpendCapsCard view={spendCaps} /> : null}
```

## a11y

- The card is a region named by its title. Every meter is a `role="progressbar"` named by its period.
- A meter that changes tone says why in its note ("Over 90% of this cap"), so the colour is never the only signal.

## Private parts

- `SpendCapsRow` - one period: a meter when it has a cap, a value line when it does not.

## Notes

- Rows sit in a column below 768px and share one row in equal columns above it, however many there are.
- Tones come from `limitTone()` in `@/lib/limits`.
- An estimate is written with a leading `~`; a billed amount is not.
