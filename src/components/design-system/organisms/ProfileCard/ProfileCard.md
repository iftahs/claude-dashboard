# ProfileCard

**Level:** Organism
**Purpose:** Card that shows how one platform is configured on this machine: its default model and plan as facts, its switches as status badges, and the lists it has authorized.

## When to use

- The Workspace page, once per platform on screen: Claude Code's settings and Codex's settings fill the same slots.
- Side by side under Both, in a `SplitLayout`, with `compact`.

## When NOT to use

- Live plan limits - use `LimitGlance`.
- A form that changes settings - the card is read-only; use the settings sections.
- A single fact - use `KeyValueRow`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `ProfileCardView` | required | The card's view model, built by `buildClaudeProfile()` or `buildCodexProfile()` in `@/lib/views/workspace`. |
| `compact` | `boolean` | `false` | Keeps the facts, the flags and the lists in one column each, for a card that takes half the page width. |
| `className` | `string` | - | Extra classes merged onto the card. |

`ProfileCardView` fields:

| Field | Type | Description |
|---|---|---|
| `key` | `'claude' \| 'codex'` | Which platform the card describes. |
| `title`, `description`, `help` | `string` | The card header: title, the file the settings come from, and the help text. |
| `state` | `SectionState \| null` | Loading or error state; `null` once the settings are loaded. |
| `facts` | `ProfileFactView[]` | `label`, `value`, `title` (the untruncated value), `help` and `capitalize`. |
| `flags` | `ProfileFlagView[]` | `label`, `value` and the badge `tone`. |
| `lists` | `ProfileListView[]` | `title`, `count`, `items` and the `empty` sentence. |

## States

- `loading` - the header and a text skeleton.
- `error` - the header and what failed.
- Ready - the facts, a divider, the flags, a divider, the lists.

## Usage

```tsx
import { ProfileCard } from '@/components/design-system/organisms/ProfileCard/ProfileCard';
```

One platform:

```tsx
<ProfileCard view={profile} />
```

Both platforms side by side:

```tsx
<SplitLayout>
  {profiles.map((profile) => (
    <ProfileCard key={profile.key} view={profile} compact />
  ))}
</SplitLayout>
```

## a11y

- The card is a named region through `Section`; its title is an `<h3>`, to sit under the page's group heading.
- A flag's state is written in its badge ("Enabled", "Off"), never carried by colour alone.
- A list with more than six items scrolls, so it is focusable and named by its title and can be scrolled from the keyboard; a shorter list is not a tab stop.

## Private parts

- `ProfileCardList` - one titled list in a sunken well, or its empty sentence.

## Notes

- Fact values never wrap: a long one truncates at 224px and keeps its full text in `title`.
- A list is at most 192px tall and scrolls inside its well.
- Presentational: the view model carries every string, so the same card serves both platforms.
