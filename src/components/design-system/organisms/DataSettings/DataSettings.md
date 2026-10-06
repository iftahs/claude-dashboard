# DataSettings

**Level:** Organism
**Purpose:** Settings card for what the dashboard keeps, sends and reads: the history archive with its forget action, the telemetry opt-out, the data folders and the installed version.

## When to use

- The Settings page, last section. Its root carries `id`, so `/settings#data` scrolls to it.

## When NOT to use

- The short folder and version lines in the sidebar footer - that is `Sidebar`.
- The "update available" notice - that is a `Toast`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `id` | `string` | required | Id of the root element, the anchor of the section. |
| `view` | `DataSettingsView` | required | Current values, built by the page hook (types in `@/lib/views/settings`). |
| `onForget` | `() => void` | required | Called after the reader confirms forgetting the archived history. |
| `onTelemetryChange` | `(optOut: boolean) => void` | required | Called with the new state of "Disable anonymous analytics". |

`DataSettingsView` fields:

| Field | Type | Description |
|---|---|---|
| `archive` | `ArchiveView` | `status`, `enabled`, `line` (what is archived), `canForget`, `busy` and `error` (a failed forget). |
| `telemetryOptOut` | `boolean` | Whether anonymous analytics are switched off. |
| `folders` | `DataFoldersView` | `status` and `rows` of `label` and `path`. |
| `version` | `VersionView` | `status`, `current`, `latest`, `updateAvailable`, `changelogUrl` and `hint` (how to update). |

Each `status` is `'loading' \| 'error' \| 'ready'`.

## States

- Archive, folders and version each load on their own: a skeleton line while `loading`, a sentence that says what could not be read on `error`, their content when `ready`.
- Forget is offered only when something is archived. It opens a confirmation dialog; while the request runs the button is disabled and reads "Forgetting". A failed request shows its message under the row as an alert.

## Usage

```tsx
import { DataSettings } from '@/components/design-system/organisms/DataSettings/DataSettings';
```

```tsx
<DataSettings id="data" view={data.view} onForget={data.onForget} onTelemetryChange={data.onTelemetryChange} />
```

## a11y

- The card is a named region through `Section`; each setting is an `<h3>` through `SettingRow`.
- The destructive action is confirmed in a `Dialog`: focus moves into it, Escape cancels, and focus returns to the Forget button.
- The archive state is written in its badge ("On", "Off"); a failed forget is a `role="alert"`.
- Folder paths truncate and keep their full text in `title`. The changelog link opens in a new tab.

## Notes

- The root is a plain `<div>` with the `id` and a 24px scroll margin, because `Section` takes no `id`.
- UI-only state: whether the confirmation dialog is open. The archive request, the opt-out and the version check belong to hooks.
- The archive itself is switched on in the server's environment, so the card shows its state and has no control for it.
