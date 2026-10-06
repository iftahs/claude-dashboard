# CodexDailyCompareChart

**Level:** Organism
**Purpose:** Card that sets OpenAI's own per-day token count for the account beside the sum of the local Codex rollouts, with both totals and how far the local sum sits from the server figure.

## When to use

- The Trends page under Codex or Both, while the Codex profile endpoint answers: it shows how much of the account's usage this machine sees.

## When NOT to use

- Claude data - Anthropic publishes no per-day server count.
- Comparing the two platforms - use `PlatformDailyCompareChart`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `CodexCompareView` | required | Built by `buildCodexCompare()` in `@/lib/views/trends`: title, description, help, state, one row per UTC day, the legend with totals and the difference line. |
| `className` | `string` | - | Extra classes merged onto the card. |

## States

- Ready: the grouped chart, the legend with the server and local totals and "Local -N% vs server".
- `view.state` loading or empty: the `Section` shows the matching state.

## Usage

```tsx
import { CodexDailyCompareChart } from '@/components/design-system/organisms/CodexDailyCompareChart/CodexDailyCompareChart';
```

```tsx
{view.codexCompare ? <CodexDailyCompareChart view={view.codexCompare} /> : null}
```

## a11y

- The chart is an image named by the card's title and description; the legend names both series with their totals.

## Notes

- Memoised on `view`: build it in a `useMemo` in the page hook.
- Both series are UTC days and count every token, cached input included, so each pair of bars measures the same thing.
