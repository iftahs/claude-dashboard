# SpendingCapsSettings

**Level:** Organism
**Purpose:** Settings card for the spending caps: a daily, weekly and monthly amount in US dollars per platform, each platform saved or cleared on its own.

## When to use

- The Settings page, fourth section. Its root carries `id`, so `/settings#spending` scrolls to it.

## When NOT to use

- Showing spend against the caps - that is the Live usage page and `LimitGlance`.
- Choosing how a crossed cap alerts - use `AlertSettings`.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `id` | `string` | required | Id of the root element, the anchor of the section. Also the prefix of the field ids. |
| `view` | `SpendingCapsSettingsView` | required | The explanation and the draft values, built by the page hook (types in `@/lib/views/settings`). |
| `onChange` | `(platform: 'claude' \| 'codex', period: 'daily' \| 'weekly' \| 'monthly', value: string) => void` | required | Called on every keystroke with the field's draft text. |
| `onSave` | `(platform: 'claude' \| 'codex') => void` | required | Called by Save, and by Enter in a field, for that platform's three caps. |
| `onClear` | `(platform: 'claude' \| 'codex') => void` | required | Called by Clear: removes that platform's caps. |

`SpendingCapsSettingsView` fields:

| Field | Type | Description |
|---|---|---|
| `description` | `string` | What the caps are checked against. Names Codex only when Codex data exists. |
| `groups` | `CapGroupView[]` | One per platform: `key`, `heading` (`null` for a single unnamed group) and `fields` (`key`, `label`, `placeholder`, `value`). |

## Usage

```tsx
import { SpendingCapsSettings } from '@/components/design-system/organisms/SpendingCapsSettings/SpendingCapsSettings';
```

```tsx
<SpendingCapsSettings id="spending" view={spending.view} onChange={spending.onChange} onSave={spending.onSave} onClear={spending.onClear} />
```

## a11y

- The card is a named region through `Section`. Each platform is a real `<form>` named "Claude spending caps" or "Codex spending caps", so Enter in a field saves that platform.
- Every field has a visible label through `FormField` and opens the decimal keypad on touch (`inputMode="decimal"`).

## Private parts

- `SpendingCapsForm` - one platform's three fields with its Clear and Save buttons.

## Notes

- The root is a plain `<div>` with the `id` and a 24px scroll margin, because `Section` takes no `id`.
- The fields hold draft text: nothing is stored until Save. Parsing and storage belong to the page hook.
- The three fields sit side by side from `md` up and stack below.
