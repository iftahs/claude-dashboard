# Section

**Level:** Organism
**Purpose:** The standard data card of a page: a titled card with a description, help, an actions slot and an AI explanation, whose body shows the content or a built-in loading, error or empty state.

## When to use

- Every data card on a page: a chart, a table, a list, a breakdown. One `Section` per card.
- `state` for the three states every card must design: loading, error, empty. Build it in the page hook.
- `ai` for a card AI Insights can explain: pass what `sectionAi(key, data)` from `useAiInsightCtx()` returns.
- `grow` for cards that share a grid row and should end at the same height.

## When NOT to use

- A stat tile - use `StatTile`.
- A bare surface with no title - use `Card`.
- A heading above a group of cards - use `GroupLabel` in a `SectionStackLayout`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `title` | `string` | required | The card title, in sentence case. It also names the card for assistive tech. |
| `description` | `ReactNode` | - | One line under the title: the range, the unit, the grouping. |
| `help` | `ReactNode` | - | Explanation shown in an `InfoTip` beside the title. |
| `actions` | `ReactNode` | - | Right slot of the header: a small `SegmentedControl`, an `ExportMenu`, a `Badge`. Stays in every state. |
| `children` | `ReactNode` | - | The content. Rendered only when `state` is not set. |
| `as` | `'h2' \| 'h3'` | `'h2'` | Heading level of the title. Use `h3` under a `GroupLabel`. |
| `grow` | `boolean` | `false` | The card fills its grid cell and the content sits at the bottom, so neighbours with shorter content line up. |
| `padding` | `'md' \| 'sm' \| 'none'` | `'md'` | 20px, 16px, or `none`: the body runs edge to edge, for a table, and the header keeps 16px so the title lines up with the table's cells. |
| `className` | `string` | - | Extra classes merged onto the card. |
| `ai` | `SectionAi \| null` | - | The AI explanation affordance (see below). |
| `state` | `SectionState \| null` | - | Replaces the content with a loading, error or empty state (see below). |

`SectionState`, from `@/lib/section` - one of:

| `kind` | Fields | Renders |
|---|---|---|
| `'loading'` | `skeleton?: 'text' \| 'stat' \| 'chart' \| 'bars' \| 'table' \| 'gauge'` (default `'text'`), `rows?: number` | The matching `SkeletonPreset`. |
| `'error'` | `title: string`, `description?: string`, `onRetry?: () => void` | An `ErrorState`, with a retry button when `onRetry` is passed. |
| `'empty'` | `title: string`, `description?: string`, `icon?: IconName`, `action?: ReactNode` | An `EmptyState`. |

`SectionAi`, from `@/lib/section`:

| Field | Type | Description |
|---|---|---|
| `onAsk` | `() => void` | Called by the "AI" button in the header. |
| `loading` | `boolean` | The request is in flight: the button reads "Thinking". |
| `disabled` | `boolean` | No AI backend is available: the button is not rendered. |
| `result` | `{ text?, loading, error?, backendLabel?, onDismiss } \| null` | When set, an `AiInsightInline` renders under the content. |

## States

- Ready (`state` not set) - the header and `children`.
- `loading` - the header and a skeleton shaped like the content. Pick the `skeleton` and `rows` that match what is coming, so the card does not jump.
- `error` - the header and what failed, with 24px above and below instead of the 48px of a standalone `ErrorState`.
- `empty` - the header and what is missing, at the same compact height.
- The AI button keeps its place but is hidden while `loading` or `error`, because there is no data to explain. It stays in the `empty` state. A result that is already open stays in every state.

## Usage

```tsx
import { Section } from '@/components/design-system/organisms/Section/Section';
```

A chart card with its state and AI affordance, both built by the page hook:

```tsx
<Section
  title="Daily tokens"
  description="Effective tokens per day, by model"
  help="Input, output and cache writes. Cache reads do not count toward limits."
  actions={rangePicker}
  state={view.state}
  ai={view.ai}
>
  <DailyTokensChart data={view.days} />
</Section>
```

A table that runs edge to edge, loading:

```tsx
<Section title="Recent sessions" padding="none" state={{ kind: 'loading', skeleton: 'table', rows: 8 }} />
```

Two cards in one row that end at the same height:

```tsx
<SplitLayout>
  <Section title="By model" grow>{modelRows}</Section>
  <Section title="By project" grow state={{ kind: 'empty', title: 'No projects yet', description: 'Projects appear after the first session.' }} />
</SplitLayout>
```

In the page hook:

```ts
const { sectionAi } = useAiInsightCtx();
const state: SectionState | null = data ? null : error ? { kind: 'error', title: 'Could not load daily tokens', description: error } : { kind: 'loading', skeleton: 'chart' };
return { state, ai: sectionAi('trends', data) };
```

## a11y

- Renders a `<section>` labelled by its title, so each card is a named region. The title is a real heading.
- The loading skeleton is a `role="status"` that reads "Loading"; the error is a `role="alert"`.
- The AI button is named "Explain this section with AI"; its result is announced when it arrives (see `AiInsightInline`).

## Notes

- Presentational: it holds no data logic. `state` and `ai` are plain data and handlers from `@/lib/section`, built in hooks, which cannot import the design system.
- Stale data stays on screen: set `state` only while there is no data to show. A failed poll with data already loaded keeps `state` unset.
- With `padding="none"` the card clips its corners; `text`, `stat`, `chart`, `bars` and `gauge` skeletons, the empty and error states and the AI result keep 16px of side padding, and the `table` skeleton runs edge to edge like the table it stands for.
- With `grow`, content and skeletons sit at the bottom of the card; the empty and error states are centred.

## Motion

- When `state` leaves `loading` for content, the body fades in once (180ms). The class comes off when the animation ends and later re-renders do not add it back, so polling never replays it.
- `EmptyState` and `ErrorState` bring their own fade.
- Under `prefers-reduced-motion` the global rule makes this instant.
