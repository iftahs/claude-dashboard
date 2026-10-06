# DisplaySettings

**Level:** Organism
**Purpose:** Settings card for how the dashboard looks and counts: the first day of the week and the dark or light theme.

## When to use

- The Settings page, second section. Its root carries `id`, so `/settings#display` scrolls to it.

## When NOT to use

- The quick theme switch in the topbar - use `ThemeToggle`.
- A range picker for one page - use a `SegmentedControl` in that page's header.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `id` | `string` | required | Id of the root element, the anchor of the section. |
| `view` | `DisplaySettingsView` | required | Current values, built by the page hook (types in `@/lib/views/settings`). |
| `onWeekStartChange` | `(weekStart: 'auto' \| 'sunday' \| 'monday') => void` | required | Called when another week start is picked. |
| `onThemeChange` | `(theme: 'dark' \| 'light') => void` | required | Called when the other theme is picked. |

`DisplaySettingsView` fields:

| Field | Type | Description |
|---|---|---|
| `weekStart` | `'auto' \| 'sunday' \| 'monday'` | The selected week start. |
| `localeNote` | `string \| null` | Shown under the control while it is on Auto: "Locale default: Monday". |
| `theme` | `'dark' \| 'light'` | The theme in use. |

## Usage

```tsx
import { DisplaySettings } from '@/components/design-system/organisms/DisplaySettings/DisplaySettings';
```

```tsx
<DisplaySettings id="display" view={display.view} onWeekStartChange={display.onWeekStartChange} onThemeChange={display.onThemeChange} />
```

## a11y

- The card is a named region through `Section`; each setting is an `<h3>` through `SettingRow`.
- Both controls are groups named "Week start" and "Theme"; the selection is carried by `aria-pressed`.

## Notes

- The root is a plain `<div>` with the `id` and a 24px scroll margin, because `Section` takes no `id`.
- The theme control and the topbar's `ThemeToggle` change the same value, so they always agree.
