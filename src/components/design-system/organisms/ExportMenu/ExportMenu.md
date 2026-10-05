# ExportMenu

**Level:** Organism
**Purpose:** Small "Export" button that opens a menu with two choices, CSV and JSON, and reports the chosen format.

## When to use

- The actions of a `PageHeader`, for the page's export. One per page.
- The actions of a `Section`, when one card has its own export.
- `disabled` while there is nothing to export yet.

## When NOT to use

- A single format - use a `Button` with the download icon.
- Other row or card actions - use `DropdownMenu` with your own items.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `onExport` | `(format: 'csv' \| 'json') => void` | required | Called with the chosen format after the menu closes. |
| `label` | `string` | `'Export'` | Text of the button. |
| `disabled` | `boolean` | `false` | Greys the button out; the menu does not open. |
| `align` | `'start' \| 'center' \| 'end'` | `'end'` | Which edge of the button the menu lines up with. |
| `className` | `string` | - | Extra classes merged onto the button. |

## Variants

- One look: a 28px secondary `Button` with the download icon, and a `DropdownMenu` with "Export CSV" and "Export JSON".

## Usage

```tsx
import { ExportMenu } from '@/components/design-system/organisms/ExportMenu/ExportMenu';
```

In a page, wired through the page hook:

```tsx
<PageHeader description="Usage over time, by model and by project." actions={<ExportMenu onExport={view.onExport} />} />
```

In the page hook, with the same data offered to the command palette:

```ts
const exportData = useExport();
const getExport = useCallback(() => (weekly ? { filename: 'trends-30d', csv: rows, json: weekly } : null), [weekly, rows]);
useRegisterPageExport(weekly ? getExport : null);
const onExport = useCallback((format: ExportFormat) => exportData(getExport, format), [exportData, getExport]);
```

Pass `null` to `useRegisterPageExport()` while there is nothing to export, so the palette's "Export current view" commands hide instead of doing nothing, and set `disabled` on the menu for the same reason.

## a11y

- The button is a native `<button>` named by `label`, with `aria-haspopup="menu"` and `aria-expanded` from `DropdownMenu`.
- Enter, Space or Arrow Down opens the menu; arrows move, Enter chooses, Escape closes and returns focus to the button.

## Notes

- Presentational: it downloads nothing and tracks nothing. `useExport()` builds the file and sends the `export_clicked` event.
- `ExportFormat` comes from `@/lib/export`.
