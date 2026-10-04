# EmptyState

**Level:** Molecule
**Purpose:** Centred icon, title and sentence that say what is missing and what makes it appear, with an optional action.

## When to use

- A card, a table or a page that has loaded and has nothing to show.
- A search or a filter that matches nothing (`icon="search"` or `icon="filter"`).

## When NOT to use

- Content that is still loading - use `SkeletonPreset`.
- A request that failed - use `ErrorState`.
- A single missing value in a row - write a dash or "None".

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `title` | `string` | required | What is missing, in sentence case: "No workflows yet". |
| `icon` | `IconName` | `'inbox'` | The 20px glyph above the title. |
| `description` | `ReactNode` | - | What makes it appear: "Run one in Claude Code and it shows up here." |
| `action` | `ReactNode` | - | One control under the text, usually a small `Button`. |
| `className` | `string` | - | Extra classes merged onto the root, for example `py-6` in a short card. |

## Variants

- One look: a `fg-subtle` icon, the title in `text-body` medium, the description in `text-small` `fg-muted`, 8px apart, centred with 48px above and below.

## Usage

```tsx
import { EmptyState } from '@/components/design-system/molecules/EmptyState/EmptyState';
```

Inside a card:

```tsx
<Card>
  <EmptyState title="No workflows yet" description="Run one in Claude Code and it shows up here." />
</Card>
```

No matches, with an action composed by the organism:

```tsx
<EmptyState icon="search" title="No sessions match" description="Try a shorter search or clear the filters." action={clearFiltersButton} />
```

## a11y

- Plain text in two paragraphs; the icon is decorative.
- It is not a live region. When it replaces content after a user action (a search, a filter), announce the result count from the consumer if that matters.

## Notes

- It has no card of its own: place it inside a `Card` or a page region.
- The description is at most 384px wide so it wraps into a readable block.
- Copy rules: no exclamation marks, no emoji, say what to do next.
