# Skeleton

**Level:** Atom
**Purpose:** One pulsing placeholder block that stands in for content while it loads.

## When to use

- Loading states: stack a few blocks in the shape of the content that is coming (a title line, text lines, bars).
- One block per line, number or bar.

## When NOT to use

- Empty states - say what is missing and what makes it appear.
- Failed requests - show the error state with a retry action.
- Never the word "Loading" or a spinner in place of content.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `width` | `number \| string` | - | Width as pixels (number) or any CSS length (`'40%'`). |
| `height` | `number \| string` | - | Height as pixels (number) or any CSS length. |
| `className` | `string` | - | Extra classes merged onto the block; size it here instead (`h-3 w-2/5`) when you prefer classes. |

## Usage

```tsx
import { Skeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
```

A title and three text lines:

```tsx
<div className="flex flex-col gap-3" aria-busy="true">
  <Skeleton width="40%" height={14} />
  <Skeleton height={8} />
  <Skeleton height={8} />
  <Skeleton width="72%" height={8} />
</div>
```

Sized with classes:

```tsx
<Skeleton className="h-6 w-24" />
```

## a11y

- Each block is `aria-hidden`. Mark the loading region with `aria-busy="true"` in the composing component so assistive tech knows content is on its way.
- The pulse is removed under `prefers-reduced-motion`.

## Notes

- `surface-hover` fill, 4px radius. A block with no width fills its container; a block with no height is invisible, so always give one.
