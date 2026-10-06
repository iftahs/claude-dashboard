# ThemeToggle

**Level:** Molecule
**Purpose:** Icon button that switches between the dark and light themes and names the theme it switches to.

## When to use

- Once, in the topbar.
- Anywhere else a one-click theme switch is wanted, such as a settings row.

## When NOT to use

- Choosing between more than two themes, or a "follow the system" option - use a `SegmentedControl` or a `Select`.
- Any other icon-only action - compose `IconButton`, `Icon` and `Tooltip` for it.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `theme` | `'dark' \| 'light'` | required | The theme that is active now. |
| `onToggle` | `() => void` | required | Called on click. The consumer flips the theme. |
| `className` | `string` | - | Extra classes merged onto the button. |

## Variants

- `theme="dark"`: sun icon, "Switch to light theme".
- `theme="light"`: moon icon, "Switch to dark theme".
- The button is a 32px ghost `IconButton`.

## Usage

```tsx
import { ThemeToggle } from '@/components/design-system/molecules/ThemeToggle/ThemeToggle';
```

In the topbar, wired to the theme hook by the connected component:

```tsx
<ThemeToggle theme={theme} onToggle={toggleTheme} />
```

## a11y

- A native `<button>` whose `aria-label` is the action it performs ("Switch to light theme"), so the name changes with the theme instead of relying on a pressed state.
- The tooltip shows the same text on hover and on keyboard focus, below the button.
- The icon is decorative. The button shows the 2px focus ring.

## Notes

- It holds no state and reads no storage: the theme and its persistence live in a hook.

## Motion

- The icon of the new theme scales in (160ms) when the theme switches.
- Under `prefers-reduced-motion` the global rule makes this instant.
