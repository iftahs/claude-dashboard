# PageLayout

**Level:** Template
**Purpose:** Centres page content inside the shell's main area at the content max width, with the page gutters and a 24px rhythm between sections.

## When to use

- As the root of every page, directly inside `AppShellLayout`'s `children`.
- `width="full"` for a page that needs the whole column, such as the AI chat.

## When NOT to use

- Outside the app shell - it has no background and no landmark of its own.
- To space cards inside one section - use `SectionStackLayout`, `SplitLayout` or `StatGridLayout`.
- Nested inside another `PageLayout` - the gutters would double.

## Slots

| Slot | Description |
|---|---|
| `header` | First row of the page, normally a `PageHeader`. Rendered before `children` with the same 24px gap. |
| `children` | The page's sections. Every direct child is one row of the stack. |

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `header` | `ReactNode` | - | Header slot. Nothing is rendered when it is omitted. |
| `children` | `ReactNode` | required | Sections slot. |
| `width` | `'default' \| 'full'` | `'default'` | `default` caps the column at 1200px (`max-w-content`, gutters included) and centres it. `full` drops the cap. |

This template does not spread native attributes - it only accepts the slots and props above.

## Responsive behaviour

- Side gutters are 32px from `lg` (1024px) up and 16px below.
- 24px of padding above the first row and 32px below the last one, at every width.
- Rows are 24px apart (`gap-6`) at every width.
- Inside `AppShellLayout` it fills the height left under the topbar, so a child can take `flex-1` to reach the bottom of the viewport.

## Usage

```tsx
import { PageLayout } from '@/components/design-system/templates/PageLayout/PageLayout';
```

A page with a header and sections:

```tsx
<PageLayout header={<PageHeader description="Your current window, plan limits and what is driving them." actions={actions} />}>
  <SectionStackLayout title={<GroupLabel>Current window</GroupLabel>}>{currentWindow}</SectionStackLayout>
  <SectionStackLayout title={<GroupLabel>Plan limits</GroupLabel>}>{planLimits}</SectionStackLayout>
</PageLayout>
```

Full width, no header:

```tsx
<PageLayout width="full">{chat}</PageLayout>
```

## a11y

- Renders a plain `<div>`: the `<main>` landmark comes from `AppShellLayout` and the page `<h1>` lives in the topbar.
- Reading and focus order follow the DOM: `header`, then `children`.

## Notes

- Layout only: no state, no hooks, no data.
- A fragment passed as `header` or as a child is flattened, so each of its elements becomes its own row.
