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
