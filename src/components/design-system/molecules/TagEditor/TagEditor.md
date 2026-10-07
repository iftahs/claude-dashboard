# TagEditor

**Level:** Molecule
**Purpose:** Row of a project's custom tags, each one renamable and removable, with a button that turns into a text field to add another.

## When to use

- Editing the short list of free-text tags on one item, such as a project in `ProjectBreakdown`.
- `suggestions` when tags already used elsewhere should be one click away while adding.

## When NOT to use

- Showing tags that cannot be edited - use `Chip` with a `color`.
- Choosing from a fixed list - use `Select` or `SegmentedControl`.
- A status - use `Badge`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `value` | `readonly string[]` | required | The item's tags, in display order. |
| `onChange` | `(tags: string[]) => void` | required | Called with the full next list after an add, a rename or a removal. The owner trims, caps and de-duplicates. |
| `label` | `string` | required | Accessible name of the group, for example "Tags for claude-dashboard". |
| `suggestions` | `readonly string[]` | `[]` | Existing tags offered as quick-adds while the add field is open. Tags already on the item are left out. |
| `addLabel` | `string` | `'Tag'` | Text of the add button, after its plus icon. |
| `className` | `string` | - | Extra classes merged onto the row. |

## Variants

- A tag: a 22px hairline chip in monospace with a 6px dot in `tagColor(tag)`, its name and a remove button.
- Idle: the tags, then a small ghost button with the plus icon.
- Adding: the button becomes a 28px field, followed by the unused suggestions as dashed chips.
- Renaming: the tag being renamed becomes the same field, holding its current name.

## Usage

```tsx
import { TagEditor } from '@/components/design-system/molecules/TagEditor/TagEditor';
```

One project's tags, stored by the page hook:

```tsx
<TagEditor
  label={`Tags for ${project.name}`}
  value={project.tags}
  suggestions={allTags}
  onChange={(next) => onTagsChange(project.path, next)}
/>
```

## a11y

- The row is a `role="group"` named by `label`.
- A tag's name is a button named "Rename tag <name>"; its remove button is named "Remove tag <name>". The dot is decorative, so a tag is never identified by colour alone.
- Enter or leaving the field commits; Escape cancels. An empty name changes nothing. After Enter, Escape or a removal, focus moves to the add button, so the keyboard keeps its place in the row.
- The rename field opens with the current name selected, so typing replaces it.
- The suggestions are a pointer shortcut and are not in the tab order: tabbing out of the field commits what was typed, which is the keyboard path to the same result.

## Notes

- UI state only: which tag is being edited and the draft. Storage, trimming, the 32 character cap and case-insensitive de-duplication belong to the owner of `value`.
- A rename replaces the tag in this list only. Renaming it to a tag the item already has merges the two once the owner de-duplicates.
- The row is at least 28px tall, so opening the field does not move what is under it.
- The dot colour comes from `tagColor()` in `@/lib/palette`, the same colour the tag has in `TagBreakdown`.
- The field's Enter and Escape are cancelled as key events before focus moves to the add button. Without that, the same Enter press would reach the newly focused button and open the field again.

## Motion

- Tag and suggestion buttons ease their text colour over 120ms.
- Under `prefers-reduced-motion` the global rule makes this instant.
