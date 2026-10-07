# LimitGlance

**Level:** Organism
**Purpose:** Card that shows one platform's plan limits at a glance: a row per rate-limit window with its percentage, meter and reset time, or the spending caps when there are no plan windows.

## When to use

- The Overview page, one card per platform on screen (Claude, Codex, or both side by side in a `SplitLayout`).
- Anywhere a platform's binding limit needs a compact summary that links to the full Live usage page.

## When NOT to use

- The detailed plan view with per-model windows, forecasts and contributors - that is the Live usage page.
- A single meter inside another card - use `MeterRow`.
- A headline number with no limit - use `StatTile`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `LimitGlanceView` | required | The card's view model, built by `buildClaudeLimits()` / `buildCodexLimits()` in `@/lib/views/overview`. |
| `href` | `string` | - | Where the card links. When set, the platform name is a link stretched over the whole card. |
| `onNavigate` | `(event, href) => void` | - | Called on a click of the link, for client-side routing: call `event.preventDefault()` and navigate. |
| `className` | `string` | - | Extra classes merged onto the card. |

`LimitGlanceView` fields:

| Field | Type | Description |
|---|---|---|
| `platform` | `'claude' \| 'codex'` | Picks the swatch colour (`platform-claude` / `platform-codex`). |
| `name` | `string` | The platform name in the header. |
| `plan` | `string \| null` | Plan badge text (`Max 20x`, `Pro`, `API`). Hidden when null. |
| `status` | `'loading' \| 'error' \| 'ready'` | Which state the body shows. |
| `windows` | `LimitWindowView[]` | One row per provider window: `label`, `percent`, `tone`, `reset` (the reset line as short phrases), `binding`. |
| `caps` | `LimitCapView[]` | Spending cap rows (`label`, `value`, `percent`, `tone`, `note`); a null `percent` draws a plain value line. |
| `message` | `{ title, description } \| null` | Why limits are missing. |
| `note` | `string \| null` | Caption under the rows. |

## States

- `loading` - a `SkeletonPreset` gauge with two rows under the real header.
- `error` - an `ErrorState` inside the card (the request itself failed).
- `ready` with `windows` - one row per window: label, a "Binding limit" badge on the row the view model marks, the percentage as the metric, an 8px `ProgressBar` and the reset line.
- `ready` with `caps` - `MeterRow` per capped period, a value line for a period with no cap, and the `message` as two quiet lines above them when one is set.
- `ready` with only `message` - an `EmptyState` that says why the limits are unavailable.

## Usage

```tsx
import { LimitGlance } from '@/components/design-system/organisms/LimitGlance/LimitGlance';
```

One card per platform, linking to Live usage:

```tsx
<SplitLayout>
  {limits.map((card) => (
    <LimitGlance key={card.platform} view={card} href="/live" onNavigate={onNavigate} />
  ))}
</SplitLayout>
```

Without a link:

```tsx
<LimitGlance view={card} />
```

## a11y

- The card is a `<section>` named by its `<h3>` platform name.
- With `href`, the name is a native `<a>` labelled "<platform> limits, open live usage"; its click area covers the card and the 2px focus ring is drawn around the whole card. That overlay also takes the pointer, so a native `title` inside the card never shows: nothing in the card relies on one.
- Every meter is a `role="progressbar"` named by its window; the percentage is also plain text, and a reached limit says "Limit reached" in the reset line, so the tone never carries the status alone.
- The swatch is decorative.

## Private parts

- `LimitGlanceWindow` - one rate-limit window row.
- `LimitGlanceCap` - one spending cap row.

## Notes

- The tone comes from the view model: `accent` below 70%, `warning` from 70%, `danger` from 90% or when the provider says the limit is reached (`limitTone()` in `@/lib/limits`).
- Presentational: no data hooks, no routing, no fetching. The card never retries by itself.
- The reset line wraps between its phrases and never inside one ("Resets in 2h 31m," / "at 04:10"), so nothing is cut off on a narrow card. The label truncates with an ellipsis; the percentage and the badges never wrap.
- `binding` is set by `markBinding()` on one row across all the cards on screen: the fullest window, the same one the topbar and the sidebar report. It stays off when only one window row is shown.

## Motion

- Each window's percentage counts up from zero once and its meter grows and glides (see `ProgressBar`).
- The rows fade in when they replace the skeleton. A linked card eases its border on hover.
- Under `prefers-reduced-motion` the global rule makes this instant.
