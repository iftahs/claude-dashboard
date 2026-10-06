# ExtraUsageCard

**Level:** Organism
**Purpose:** Card for paying beyond the plan: Anthropic extra usage credits against their monthly limit, or the ChatGPT credit balance and reset credits, or a sentence saying why it is off.

## When to use

- The Live usage page, under the plan limits: one card per platform that reports pay-beyond-the-plan credits.

## When NOT to use

- The plan's own rate-limit windows - use `PlanLimitsCard`.
- The user's own spending caps - use `SpendCapsCard`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `ExtraUsageView` | required | The card's view model, built by `claudeExtraUsageView()` or `codexCreditsView()` in `@/lib/views/live`. |
| `className` | `string` | - | Extra classes merged onto the card. |

`ExtraUsageView` fields:

| Field | Type | Description |
|---|---|---|
| `platform` | `'claude' \| 'codex'` | Which platform the credits belong to; use it as the React key. |
| `title` | `string` | "Extra usage" or "Credits". |
| `help` | `string` | What these credits are and when they are billed. |
| `enabled` | `boolean` | Pay-beyond-the-plan is on: the headline row shows. Otherwise `disabledCopy` shows. |
| `usage` | `{ label, value, limit, pct, tone }` | The headline: a meter when `pct` is set, a plain value line when it is null (a balance with no limit). |
| `disabledCopy` | `string` | Why it is off and what that means. |
| `rows` | `{ label, value, tone? }[]` | Extra facts: reset credits, an overage limit that was reached. |
| `disclaimer` | `{ text, linkText, href }` | The provider's footnote, with an optional link that opens in a new tab. |

## States

- Enabled with a limit - a meter: "$66.07 of $250.00" and the share used.
- Enabled without a limit - the balance as a value line.
- Off - one sentence that says who turned it off and that usage pauses at the plan limit.

## Usage

```tsx
import { ExtraUsageCard } from '@/components/design-system/organisms/ExtraUsageCard/ExtraUsageCard';
```

One card:

```tsx
<ExtraUsageCard view={extra} />
```

Both platforms:

```tsx
<SplitLayout>
  {extras.map((extra) => (
    <ExtraUsageCard key={extra.platform} view={extra} />
  ))}
</SplitLayout>
```

## a11y

- The card is a region named by its title. The meter is a `role="progressbar"` and the amounts are plain text.
- The disclaimer link is a native `<a>` with its own focus ring; it opens in a new tab with `rel="noreferrer"`.

## Notes

- The meter tone comes from `limitTone()` in `@/lib/limits`.
- The link is kept only when it is an `http` or `https` address; the view builder drops anything else.
- It has no loading state of its own: the page shows the card only once the provider has reported the credits.
