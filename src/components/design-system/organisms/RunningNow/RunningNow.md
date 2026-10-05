# RunningNow

**Level:** Organism
**Purpose:** Card that summarises what is running right now: counts of running agents, agents waiting on you and running workflows, then a short list of the sessions and workflows behind them.

## When to use

- The Overview page, as the glance at live agent activity with a link to the Agents page.
- Any page that needs a compact "what is running" strip instead of the full agent tree.

## When NOT to use

- The full live view with subagents nested under their session - that is the Agents page.
- A list of finished runs - use a table.
- A single count - use `StatTile`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `RunningNowView` | required | The card's view model, built by `buildRunning()` in `@/lib/views/overview`. |
| `href` | `string` | required | Where the "Open agents" link goes. |
| `onNavigate` | `(event, href) => void` | - | Called on a click of the link, for client-side routing: call `event.preventDefault()` and navigate. |
| `className` | `string` | - | Extra classes merged onto the card. |

`RunningNowView` fields:

| Field | Type | Description |
|---|---|---|
| `status` | `'loading' \| 'error' \| 'ready'` | Which state the body shows. |
| `stats` | `RunningStatView[]` | Inline counts: `value`, `label`, and `alert` for the danger tone with an alert icon. |
| `rows` | `RunningRowView[]` | Up to five rows, waiting ones first: `waiting`, `project`, `task`, `badge`, `model`, `modelColor`, `since`. |
| `more` | `number` | How many running items did not fit; shown as a caption when above zero. |
| `message` | `{ title, description } \| null` | The error text. |

## States

- `loading` - a `SkeletonPreset` text block under the header link.
- `error` - an `ErrorState` inside the card.
- `ready` with rows - the inline stats, then one 44px row per item: a `StatusDot` (danger when waiting, pulsing success when running), the project, the task, a `Badge` ("Waiting on you", "Workflow", "Codex"), the model `Chip` and a ticking `ElapsedTime`.
- `ready` with no rows - the stats and the line "Nothing is running right now."

## Usage

```tsx
import { RunningNow } from '@/components/design-system/organisms/RunningNow/RunningNow';
```

On the Overview page:

```tsx
<RunningNow view={running} href="/agents" onNavigate={onNavigate} />
```

With plain browser navigation:

```tsx
<RunningNow view={running} href="/agents" />
```

## a11y

- The card is a `<section>` labelled "Running now"; the rows are a `<ul>`.
- A waiting row says "Waiting on you" in its badge and a running row carries a visually hidden "Running" on its dot, so the status never rests on colour alone. The waiting count pairs its danger tone with an alert icon and the words "waiting on you".
- "Open agents" is a native `<a href>` with the 2px focus ring; middle-click and "open in new tab" keep working.
- The elapsed time is plain ticking text, not a live region.

## Private parts

- `RunningNowStat` - one inline count with its label.
- `RunningNowRow` - one running session, thread or workflow.

## Notes

- The project and the task truncate with an ellipsis and keep their full text in `title`; the badge, the chip and the elapsed time never wrap.
- Below 640px the task and the model chip are hidden so the row keeps the project, the badge and the elapsed time on one line.
- `modelColor` is a token colour string from `modelColor()`; a null value draws the chip without a dot.
- Presentational: no hooks, no routing, no fetching.
