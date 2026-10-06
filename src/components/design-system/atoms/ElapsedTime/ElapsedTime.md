# ElapsedTime

**Level:** Atom
**Purpose:** Ticking text that shows how long ago a moment was, as a running duration or as a relative time.

## When to use

- A running clock on something live: how long an agent, a workflow or a turn has been going (`format="elapsed"`).
- A freshness note under a day old: "Updated 25s ago" (`format="ago"`).

## When NOT to use

- A fixed duration that is already known, such as a finished run - format the number once in the consumer and render plain text.
- A moment more than a day old - show a date.
- A countdown to a future moment (a limit reset) - this only counts up from a past moment.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `since` | `number` | required | The moment to count from, in epoch milliseconds. A future or non-finite value shows zero. |
| `format` | `'elapsed' \| 'ago'` | `'elapsed'` | `elapsed`: `36s`, `4m 12s`, `1h 16m`, `2d 3h`. `ago`: `25s ago`, `4m ago`, `2h ago`, `3d ago`. |
| `intervalMs` | `number` | `1000` | How often the text is recomputed. Use `60000` for `ago` labels that only need minute precision. Values below 250 are raised to 250. |
| `className` | `string` | - | Extra classes merged onto the `<span>`, usually the type and colour: `font-mono text-mono text-fg-muted`. |

## Variants

- `format`: `elapsed` shows the two largest units, `ago` shows the largest unit followed by "ago".
- The text inherits its font, size and colour from the parent or from `className`.

## Usage

```tsx
import { ElapsedTime } from '@/components/design-system/atoms/ElapsedTime/ElapsedTime';
```

Running clock in a dense row:

```tsx
<ElapsedTime since={agent.startedAt} className="font-mono text-mono text-fg-muted" />
```

Freshness note, recomputed once a minute:

```tsx
<span className="text-caption text-fg-subtle">
  Updated <ElapsedTime since={lastFetch} format="ago" intervalMs={60000} />
</span>
```

## a11y

- Plain text in a `<span>`; it is deliberately not a live region, so a ticking value is not announced every second.
- Screen readers read the current value when they reach it. Put the meaning in the surrounding text ("Running for", "Updated").

## Notes

- Never wraps, and uses tabular numerals so the text does not jitter as it ticks.
- Holds one timer per instance, cleared on unmount and restarted when `since` or `intervalMs` changes. This is the only design-system component allowed to use `setInterval`.
- The pure formatters live in `utils.ts` (`formatElapsed`, `formatAgo`) and take a duration in milliseconds.
