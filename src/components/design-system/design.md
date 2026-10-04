# AI Usage Design System - Component Index

This is the entry point to the AI Usage design system. Before building or changing any UI, find
the component you need below, open its linked `ComponentName.md` for props, variants and usage,
and build from that doc. Do not read the component's `.tsx` source - the `.md` holds what you need
and reading source wastes tokens. If nothing here fits, compose existing atoms and molecules
rather than writing raw markup.

- **Design system** (this index): `src/components/design-system/{atoms,molecules,organisms,templates}/<Name>/`
- **Pages**: `src/pages/<Name>Page/` - one component per screen, a template plus design-system
  components, wired through one page hook.
- **Connected components**: `src/components/common/<Name>/` - bind design-system components to
  real data through hooks.
- **Hooks**: `src/hooks/` - all business logic (fetching, polling, storage, analytics); page hooks
  are `src/hooks/use<Name>Page.ts`.
- **Tokens**: `src/styles/tokens.css` - semantic CSS variables with dark and light values, mapped
  to Tailwind classes in `tailwind.config.js`.
- **Visual rules** come from the "AI Usage Design System": calm and minimal, clay as the single
  accent, 12px minimum text, no raw hex - colours only through tokens.

<!-- generated:start -->
## Atoms

| Component | Purpose | Doc |
|---|---|---|
| Badge | Short status or count label on a soft tinted fill. | [Badge.md](atoms/Badge/Badge.md) |
| Button | Triggers an action with a text label, optionally led by an icon passed as a child. | [Button.md](atoms/Button/Button.md) |
| Card | Flat surface container with a hairline border and a 10px radius that holds one block of content. | [Card.md](atoms/Card/Card.md) |
| Chip | Compact monospace tag for a model, project or other identifier, with an optional colour dot. | [Chip.md](atoms/Chip/Chip.md) |
| Icon | Draws one Lucide glyph by name at a fixed size with a 1.5 stroke in the current text colour. | [Icon.md](atoms/Icon/Icon.md) |
| IconButton | Square button that shows only an icon and carries its name in a required label. | [IconButton.md](atoms/IconButton/IconButton.md) |
| Input | Single-line text field outlined in the control border, with an invalid state. | [Input.md](atoms/Input/Input.md) |
| Kbd | Shows a keyboard shortcut hint as a small bordered key cap in monospace. | [Kbd.md](atoms/Kbd/Kbd.md) |
| LegendDot | One chart legend entry: a colour swatch, the series name and an optional value. | [LegendDot.md](atoms/LegendDot/LegendDot.md) |
| Markdown | Renders a safe subset of markdown from model output as React elements, never as raw HTML. | [Markdown.md](atoms/Markdown/Markdown.md) |
| ProgressBar | Horizontal meter that fills a rounded track to a percentage in a status tone. | [ProgressBar.md](atoms/ProgressBar/ProgressBar.md) |
| Select | Dropdown that picks one value from a short list of options, with a trigger styled like an input. | [Select.md](atoms/Select/Select.md) |
| Skeleton | One pulsing placeholder block that stands in for content while it loads. | [Skeleton.md](atoms/Skeleton/Skeleton.md) |
| Sparkline | Draws a tiny bar trend from a list of numbers, with no axes, labels or tooltip. | [Sparkline.md](atoms/Sparkline/Sparkline.md) |
| StatusDot | Small round dot that shows a status tone, with an optional live pulse and screen-reader label. | [StatusDot.md](atoms/StatusDot/StatusDot.md) |
| Table | Full-width table element that sets the base type and holds header and body rows. | [Table.md](atoms/Table/Table.md) |
| TableCell | Table cell that renders a column header, a text cell or a right-aligned monospace number. | [TableCell.md](atoms/TableCell/TableCell.md) |
| TableRow | Table row with a top hairline, an optional hover fill and a selected state. | [TableRow.md](atoms/TableRow/TableRow.md) |
| Tooltip | Shows a short floating explanation when its trigger is hovered or focused. | [Tooltip.md](atoms/Tooltip/Tooltip.md) |

## Molecules

| Component | Purpose | Doc |
|---|---|---|

## Organisms

| Component | Purpose | Doc |
|---|---|---|

## Templates

| Component | Purpose | Doc |
|---|---|---|
<!-- generated:end -->

## Notes

- Everything between the `generated` markers is written by `node scripts/generate-design-index.mjs`
  from each component's `**Purpose:**` line. Never edit it by hand - edit the component's `.md`
  and regenerate.
- `node scripts/check-design-system.mjs` enforces the rules below and fails on a stale index.
- Tiers are decided by imports: an atom imports no other design-system component, a molecule
  imports only atoms, an organism imports atoms, molecules and organisms, a template (always named
  `<Name>Layout`) imports atoms, molecules and organisms and holds layout only.
- Every component folder holds `<Name>.tsx` (one exported component), `types.ts` and `<Name>.md`,
  plus `utils.ts` and `<Name>.variants.ts` when needed. No `index.ts` barrels - import by deep
  path (`@/components/design-system/atoms/Button/Button`). A folder's `utils.ts` serves only that
  folder.
- Business logic lives in hooks. Design-system components hold UI-only state (open/closed, hover,
  copied) and never poll, fetch, read storage, track analytics or route.
- Theming goes through tokens: no raw hex, no `dark:` variants, no arbitrary `text-[Npx]` sizes,
  and none of the legacy `ink-*` / `clay-*` / `zinc-*` palette classes.
- Pages and connected components are not listed here - they are not reusable parts.
- `src/components/legacy/` is the old UI, exempt from every rule and removed once the rebuild
  lands. Do not import it from the design system.
