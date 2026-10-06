# TasksPanel

**Level:** Organism
**Purpose:** Card with two lists side by side: the tasks the coding agent is tracking, each with its status, and the plan documents it saved, each with its size and age.

## When to use

- The Workspace page, once, for the platform or platforms on screen. Under Both each plan names its platform.

## When NOT to use

- Agents or workflows that are running now - use `RunningNow` or the Agents page.
- Past sessions - that is the Sessions page.

## Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `view` | `TasksSectionView` | required | The card's view model: the header fields built in the page hook plus the body from `buildTasks()` in `@/lib/views/workspace`. |
| `className` | `string` | - | Extra classes merged onto the card. |

`TasksSectionView` fields:

| Field | Type | Description |
|---|---|---|
| `title`, `description`, `help` | `string` | The card header. |
| `state` | `SectionState \| null` | Loading, error or empty state; `null` when there is a task or a plan to show. |
| `ai` | `SectionAi \| null` | The AI explanation affordance from `sectionAi('tasks', data)`. |
| `hasTasks` | `boolean` | Whether any task is tracked; when false the Tasks column shows `tasksEmpty`. |
| `tasksSummary` | `string \| null` | Beside the Tasks label: "82% complete · 40 total". |
| `statuses` | `TaskStatusView[]` | One badge per status with its count: `key`, `label`, `tone`. |
| `tasks` | `TaskRowView[]` | `key`, `status`, `tone`, `subject`. At most 12. |
| `tasksMore`, `plansMore` | `string \| null` | "Showing 12 of 40", when the list is cut. |
| `tasksEmpty`, `plansEmpty` | `string` | The sentence a column shows when it has no rows. |
| `plansSummary` | `string` | Beside the Plans label: "9 total". |
| `plans` | `PlanRowView[]` | `key`, `platform`, `title`, `size`, `age`. At most 14. |

## States

- `loading` - the header and a text skeleton.
- `error` - the header and what failed.
- `empty` - the header and what makes tasks and plans appear, when both lists are empty.
- Ready - the two columns from `lg` up, stacked below. A column with no rows shows its own sentence, so Codex can say it keeps no task list.

## Usage

```tsx
import { TasksPanel } from '@/components/design-system/organisms/TasksPanel/TasksPanel';
```

```tsx
<TasksPanel view={tasks} />
```

## a11y

- The card is a named region through `Section`; its title is an `<h3>`.
- Both lists are real `<ul>`s named "Tasks" and "Plans".
- A task's status is written in its badge; the tone only reinforces it.

## Notes

- Subjects and plan titles truncate with an ellipsis and keep their full text in `title`; the badges, the size and the age never wrap.
- Presentational: slicing, formatting and status tones come from the view model.
