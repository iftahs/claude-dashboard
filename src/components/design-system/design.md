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
| ElapsedTime | Ticking text that shows how long ago a moment was, as a running duration or as a relative time. | [ElapsedTime.md](atoms/ElapsedTime/ElapsedTime.md) |
| GroupLabel | Uppercase section heading in the label style, with an optional quiet note after it. | [GroupLabel.md](atoms/GroupLabel/GroupLabel.md) |
| Icon | Draws one Lucide glyph by name at a fixed size with a 1.5 stroke in the current text colour. | [Icon.md](atoms/Icon/Icon.md) |
| IconButton | Square button that shows only an icon and carries its name in a required label. | [IconButton.md](atoms/IconButton/IconButton.md) |
| InfoTip | Small help-icon button that opens a short explanation in a popover on click. | [InfoTip.md](atoms/InfoTip/InfoTip.md) |
| Input | Single-line text field outlined in the control border, with an invalid state. | [Input.md](atoms/Input/Input.md) |
| Kbd | Shows a keyboard shortcut hint as a small bordered key cap in monospace. | [Kbd.md](atoms/Kbd/Kbd.md) |
| LegendDot | One chart legend entry: a colour swatch, the series name and an optional value. | [LegendDot.md](atoms/LegendDot/LegendDot.md) |
| Markdown | Renders a safe subset of markdown from model output as React elements, never as raw HTML. | [Markdown.md](atoms/Markdown/Markdown.md) |
| PageHeader | Row under the topbar that pairs a one-line page description, or other left content, with the page's actions on the right. | [PageHeader.md](atoms/PageHeader/PageHeader.md) |
| ProgressBar | Horizontal meter that fills a rounded track to a percentage in a status tone. | [ProgressBar.md](atoms/ProgressBar/ProgressBar.md) |
| SegmentedControl | Row of two to five always-visible options on a neutral track, one of which is selected. | [SegmentedControl.md](atoms/SegmentedControl/SegmentedControl.md) |
| Select | Dropdown that picks one value from a short list of options, with a trigger styled like an input. | [Select.md](atoms/Select/Select.md) |
| Skeleton | One pulsing placeholder block that stands in for content while it loads. | [Skeleton.md](atoms/Skeleton/Skeleton.md) |
| Sparkline | Draws a tiny bar trend from a list of numbers, with no axes, labels or tooltip. | [Sparkline.md](atoms/Sparkline/Sparkline.md) |
| StatusDot | Small round dot that shows a status tone, with an optional live pulse and screen-reader label. | [StatusDot.md](atoms/StatusDot/StatusDot.md) |
| Table | Full-width table element that sets the base type and holds header and body rows. | [Table.md](atoms/Table/Table.md) |
| TableCell | Table cell that renders a column header, a text cell or a right-aligned monospace number. | [TableCell.md](atoms/TableCell/TableCell.md) |
| TableRow | Table row with a top hairline, an optional hover fill and a selected state. | [TableRow.md](atoms/TableRow/TableRow.md) |
| Tabs | Underlined tab list that switches between the views of one page, with the panels rendered by the consumer. | [Tabs.md](atoms/Tabs/Tabs.md) |
| Tooltip | Shows a short floating explanation when its trigger is hovered or focused. | [Tooltip.md](atoms/Tooltip/Tooltip.md) |

## Molecules

| Component | Purpose | Doc |
|---|---|---|
| CardHeader | Top row of a card: its title and one-line description on the left, a help popover beside the title and an actions slot on the right. | [CardHeader.md](molecules/CardHeader/CardHeader.md) |
| ChartTooltip | Floating read-out for a chart's hovered point: a title, one row per series with its value, and an optional footer. | [ChartTooltip.md](molecules/ChartTooltip/ChartTooltip.md) |
| Dialog | Modal panel over a dimmed page with a title, a scrolling body, an optional footer of actions and a close button. | [Dialog.md](molecules/Dialog/Dialog.md) |
| DropdownMenu | Menu of actions that opens from a trigger element, with an optional icon, a danger tone and a disabled state per item. | [DropdownMenu.md](molecules/DropdownMenu/DropdownMenu.md) |
| EmptyState | Centred icon, title and sentence that say what is missing and what makes it appear, with an optional action. | [EmptyState.md](molecules/EmptyState/EmptyState.md) |
| ErrorState | Centred alert that says what failed and what to do, with an optional retry button. | [ErrorState.md](molecules/ErrorState/ErrorState.md) |
| FormField | Wraps one form control with its label and a helper line that an error message replaces. | [FormField.md](molecules/FormField/FormField.md) |
| LiveStatus | Status dot and a caption that say whether the page is receiving live data, paused or failing. | [LiveStatus.md](molecules/LiveStatus/LiveStatus.md) |
| MeterRow | Labelled meter: a name on the left, its value in monospace on the right, a progress bar underneath and an optional note. | [MeterRow.md](molecules/MeterRow/MeterRow.md) |
| NavItem | Sidebar link with an icon, a label and an optional badge, which collapses to an icon with a tooltip in the rail. | [NavItem.md](molecules/NavItem/NavItem.md) |
| SkeletonPreset | Ready-made loading placeholder in the shape of common content: text, a stat, a chart, meter rows, a table or a limit gauge. | [SkeletonPreset.md](molecules/SkeletonPreset/SkeletonPreset.md) |
| StatTile | Card that shows one number under an uppercase label, with an optional line of context and a help popover. | [StatTile.md](molecules/StatTile/StatTile.md) |
| ThemeToggle | Icon button that switches between the dark and light themes and names the theme it switches to. | [ThemeToggle.md](molecules/ThemeToggle/ThemeToggle.md) |
| Toast | Floating notice with a status icon, a title and a sentence, an optional action and a dismiss button. | [Toast.md](molecules/Toast/Toast.md) |

## Organisms

| Component | Purpose | Doc |
|---|---|---|

## Templates

| Component | Purpose | Doc |
|---|---|---|
| AppShellLayout | Application frame with a sidebar column, a sticky topbar and a scrolling main area, where the sidebar becomes a modal drawer below 1024px. | [AppShellLayout.md](templates/AppShellLayout/AppShellLayout.md) |
| PageLayout | Centres page content inside the shell's main area at the content max width, with the page gutters and a 24px rhythm between sections. | [PageLayout.md](templates/PageLayout/PageLayout.md) |
| SectionStackLayout | Vertical stack that groups cards under an optional section title. | [SectionStackLayout.md](templates/SectionStackLayout/SectionStackLayout.md) |
| SplitLayout | Places content side by side in two or three columns that collapse to a single column on narrow screens. | [SplitLayout.md](templates/SplitLayout/SplitLayout.md) |
| StatGridLayout | Responsive grid that lays stat tiles out in two to six equal columns with 16px between them. | [StatGridLayout.md](templates/StatGridLayout/StatGridLayout.md) |
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
