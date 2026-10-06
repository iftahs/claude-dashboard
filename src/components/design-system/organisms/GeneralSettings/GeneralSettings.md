# GeneralSettings

**Level:** Organism
**Purpose:** Settings card for how the dashboard reads your accounts: the Claude usage mode with what was detected, and the read-only status of the Codex login.

## When to use

- The Settings page, first section. Its root carries `id`, so `/settings#general` scrolls to it.

## When NOT to use

- A platform's own configuration (model, effort, permissions) - use `ProfileCard` on the Workspace page.
- Live plan limits - use `LimitGlance`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `id` | `string` | required | Id of the root element, the anchor of the section. |
| `view` | `GeneralSettingsView` | required | Current values, built by the page hook (types in `@/lib/views/settings`). |
| `onModeChange` | `(mode: 'auto' \| 'subscription' \| 'api') => void` | required | Called when another usage mode is picked. |

`GeneralSettingsView` fields:

| Field | Type | Description |
|---|---|---|
| `modeTitle` | `string` | "Usage mode", or "Claude usage mode" when Codex data exists. |
| `mode` | `'auto' \| 'subscription' \| 'api'` | The selected mode. |
| `detected` | `string` | What the server detected: "Subscription" or "API · pay-as-you-go". |
| `overridden` | `boolean` | Adds "overridden" after the detected mode. |
| `codex` | `StatusRow[] \| null` | Codex plan and token rows (`label`, `value`, `note`, `tone`); `null` hides the block. |

## Usage

```tsx
import { GeneralSettings } from '@/components/design-system/organisms/GeneralSettings/GeneralSettings';
```

```tsx
<GeneralSettings id="general" view={general.view} onModeChange={general.onModeChange} />
```

## a11y

- The card is a named region through `Section`; each setting is an `<h3>` through `SettingRow`.
- The mode control is a group named by the setting's title; the selected mode is carried by `aria-pressed`.
- A Codex row's tone only reinforces its words ("Expired", "OK"); the note under it says what to do.

## Notes

- The root is a plain `<div>` with the `id` and a 24px scroll margin, because `Section` takes no `id`.
- The Codex block is read-only: nothing here changes the Codex login.
