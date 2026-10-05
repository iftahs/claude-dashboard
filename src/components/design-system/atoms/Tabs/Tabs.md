# Tabs

**Level:** Atom
**Purpose:** Underlined tab list that switches between the views of one page, with the panels rendered by the consumer.

## When to use

- A page or a card with two to six sibling views of the same subject: Spend, Efficiency, Activity.
- With `count` when a tab names a list and the number of items helps choose it.

## When NOT to use

- Filtering or scoping the data already on screen (range, platform) - use `SegmentedControl`.
- Navigating between pages - use the sidebar `NavItem`.
- More views than fit on one line - use `Select`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `items` | `readonly { value: T; label: string; count?: number }[]` | required | The tabs, in display order. Each `value` must be unique. |
| `value` | `T` | required | The selected tab's `value`. |
| `onChange` | `(value: T) => void` | required | Called with a tab's `value` when it is clicked or reached with the arrow keys. Not called for the tab that is already selected. |
| `ariaLabel` | `string` | required | Accessible name of the tab list, for example "Trends views". |
| `id` | `string` | - | Base id. When set, each tab gets `id="<id>-tab-<value>"` and `aria-controls="<id>-panel-<value>"`. |
| `className` | `string` | - | Extra classes merged onto the list, for example `flex-1`. |

`T` is inferred from `items` and defaults to `string`.

## Variants

- Selected tab: `fg` text over a 2px `accent` underline.
- Other tabs: `fg-muted` text that turns `fg` on hover, no underline.
- `count` renders after the label in regular-weight monospace `fg-subtle`.
- The list draws a `line` hairline along its bottom edge; the selected underline sits on top of it.

## Usage

```tsx
import { Tabs } from '@/components/design-system/atoms/Tabs/Tabs';
```

Tab list with linked panels (the consumer renders the panel):

```tsx
<Tabs
  id="trends"
  ariaLabel="Trends views"
  value={view}
  onChange={onViewChange}
  items={[
    { value: 'spend', label: 'Spend' },
    { value: 'efficiency', label: 'Efficiency' },
    { value: 'activity', label: 'Activity' },
  ]}
/>
<div role="tabpanel" id={`trends-panel-${view}`} aria-labelledby={`trends-tab-${view}`} tabIndex={0}>
  {panel}
</div>
```

With counts:

```tsx
<Tabs ariaLabel="Agents" value={filter} onChange={onFilterChange} items={[{ value: 'running', label: 'Running', count: 3 }, { value: 'done', label: 'Finished', count: 12 }]} />
```

## a11y

- `role="tablist"` named by `ariaLabel`; each tab is a `<button role="tab">` with `aria-selected`.
- Roving focus: only the selected tab is in the tab order. Left and Right arrows move to the previous and next tab and wrap around, Home and End jump to the first and last; the tab that receives focus is selected.
- Each tab shows the 2px focus ring.
- The consumer owns the panel. Pass `id` and give the panel `role="tabpanel"`, `id="<id>-panel-<value>"` and `aria-labelledby="<id>-tab-<value>"`. Without `id` no `aria-controls` is set, so nothing points at a missing element.

## Notes

- Controlled only: the consumer owns `value`. A `value` that matches no item leaves every tab unselected and keeps the first one reachable by keyboard.
- Tabs are 36px tall, 20px apart, never wrap and never shrink.
- A tab `value` is used inside element ids, so keep it free of spaces.
