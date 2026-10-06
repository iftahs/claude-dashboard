# AlertSettings

**Level:** Organism
**Purpose:** Settings card for the dashboard's three kinds of alerts: an agent waiting on you, a plan limit crossing a threshold, and spend crossing a spending cap.

## When to use

- The Settings page, third section. Its root carries `id`, so `/settings#alerts` scrolls to it.

## When NOT to use

- Showing an alert that fired - use `Toast`.
- Entering the caps that budget alerts watch - use `SpendingCapsSettings`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `id` | `string` | required | Id of the root element, the anchor of the section. |
| `view` | `AlertSettingsView` | required | Current values, built by the page hook (types in `@/lib/views/settings`). |
| `onAgentChange` | `(mode: 'visual' \| 'notification' \| 'sound') => void` | required | Called when another agent alert mode is picked. |
| `onLimitModeChange` | `(mode: 'off' \| 'notification' \| 'sound') => void` | required | Called when another limit alert mode is picked. |
| `onThresholdToggle` | `(threshold: number) => void` | required | Called with the percentage whose box was clicked. |
| `onBudgetChange` | `(mode: 'off' \| 'notification' \| 'sound') => void` | required | Called when another budget alert mode is picked. |

`AlertSettingsView` fields:

| Field | Type | Description |
|---|---|---|
| `agent` | `'visual' \| 'notification' \| 'sound'` | The agent alert mode. |
| `limitDescription`, `budgetDescription` | `string` | The explanations, which name Codex only when Codex data exists. |
| `limitMode`, `budgetMode` | `'off' \| 'notification' \| 'sound'` | The limit and budget alert modes. |
| `thresholds` | `ThresholdView[]` | One box per percentage: `value`, `label`, `checked`. |

## States

- With `limitMode` set to `off`, the threshold boxes are disabled and keep their ticks.

## Usage

```tsx
import { AlertSettings } from '@/components/design-system/organisms/AlertSettings/AlertSettings';
```

```tsx
<AlertSettings
  id="alerts"
  view={alerts.view}
  onAgentChange={alerts.onAgentChange}
  onLimitModeChange={alerts.onLimitModeChange}
  onThresholdToggle={alerts.onThresholdToggle}
  onBudgetChange={alerts.onBudgetChange}
/>
```

## a11y

- The card is a named region through `Section`; each setting is an `<h3>` through `SettingRow`.
- Each mode control is a group named by its setting; the thresholds are a `role="group"` named "Alert at".
- Every threshold is a native checkbox with its percentage as the label.

## Notes

- The root is a plain `<div>` with the `id` and a 24px scroll margin, because `Section` takes no `id`.
- The last ticked threshold cannot be cleared: the hook keeps at least one, so its box stays ticked.
