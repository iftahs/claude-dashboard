# AiSettings

**Level:** Organism
**Purpose:** Settings card for AI insights: the provider, the model and the API key that power the AI chat and the AI button on each card.

## When to use

- The Settings page, fifth section. Its root carries `id`, so `/settings#ai` scrolls to it; the AI insights page links here when no backend is available.

## When NOT to use

- Asking a question - use `AiChat`.
- Switching the model from the chat - the AI insights page header has its own `Select` bound to the same value.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `id` | `string` | required | Id of the root element, the anchor of the section. Also the prefix of the field ids. |
| `view` | `AiSettingsView` | required | Current values and options, built by the page hook (types in `@/lib/views/settings`). |
| `onProviderChange` | `(provider: string) => void` | required | Called with the picked provider's value. |
| `onModelChange` | `(model: string) => void` | required | Called with the picked model id. |
| `onKeyChange` | `(key: string) => void` | required | Called on every keystroke with the draft key. |
| `onToggleKeyShown` | `() => void` | required | Called by the Show key / Hide key button. |
| `onSaveKey` | `() => void` | required | Called by Save key and by Enter in the key field. |
| `onClearKey` | `() => void` | required | Called by Clear, which is shown only while a key is saved. |

`AiSettingsView` fields:

| Field | Type | Description |
|---|---|---|
| `provider`, `providers` | `string`, `{ value, label }[]` | The selected provider and the choices. |
| `model`, `models` | `string`, `{ value, label }[]` | The selected model and the provider's models. |
| `key` | `string` | The draft text of the key field. |
| `keyPlaceholder` | `string` | Says whether a key is already saved. |
| `keyShown` | `boolean` | The field shows the key as text instead of masking it. |
| `keySaved` | `boolean` | A key is stored: the status line says so and Clear is offered. |

## Usage

```tsx
import { AiSettings } from '@/components/design-system/organisms/AiSettings/AiSettings';
```

```tsx
<AiSettings
  id="ai"
  view={ai.view}
  onProviderChange={ai.onProviderChange}
  onModelChange={ai.onModelChange}
  onKeyChange={ai.onKeyChange}
  onToggleKeyShown={ai.onToggleKeyShown}
  onSaveKey={ai.onSaveKey}
  onClearKey={ai.onClearKey}
/>
```

## a11y

- The card is a named region through `Section`; the key field and its buttons sit in a `<form>` named "API key", so Enter in the field saves it.
- Every field has a visible label through `FormField`; both selects also carry their name in `ariaLabel`.
- The key is masked by default (`type="password"`); the Show key button carries `aria-pressed`.

## Notes

- The root is a plain `<div>` with the `id` and a 24px scroll margin, because `Section` takes no `id`.
- The component never stores or logs the key: it only passes the draft text to `onKeyChange`. Where it is kept is the hook's business.
- Provider and Model sit side by side from `md` up and stack below.
- The two selects stay outside the `<form>` on purpose: inside one, Radix Select mirrors itself in a hidden native `<select>` that reports an empty value whenever the options change, which would blank the model after a provider switch.
