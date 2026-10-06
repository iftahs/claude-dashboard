import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import { GroupLabel } from '@/components/design-system/atoms/GroupLabel/GroupLabel';
import { Section } from '@/components/design-system/organisms/Section/Section';
import type { TasksPanelProps } from './types';

export function TasksPanel({ view, className }: TasksPanelProps) {
  return (
    <Section
      as="h3"
      title={view.title}
      description={view.description}
      help={view.help}
      state={view.state}
      ai={view.ai}
      className={className}
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-3">
          <GroupLabel as="span" note={view.tasksSummary}>
            Tasks
          </GroupLabel>
          {view.hasTasks ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                {view.statuses.map((status) => (
                  <Badge key={status.key} tone={status.tone}>
                    {status.label}
                  </Badge>
                ))}
              </div>
              {view.tasks.length > 0 ? (
                <ul aria-label="Tasks" className="divide-y divide-line rounded-control border border-line">
                  {view.tasks.map((task) => (
                    <li key={task.key} className="flex min-w-0 items-center gap-2 px-3 py-2">
                      <Badge tone={task.tone} className="min-w-20 justify-center">
                        {task.status}
                      </Badge>
                      <span title={task.subject} className="min-w-0 flex-1 truncate text-small text-fg">
                        {task.subject}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {view.tasksMore ? <p className="text-caption text-fg-subtle">{view.tasksMore}</p> : null}
            </>
          ) : (
            <p className="text-small text-fg-muted">{view.tasksEmpty}</p>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <GroupLabel as="span" note={view.plansSummary}>
            Plans
          </GroupLabel>
          {view.plans.length > 0 ? (
            <>
              <ul aria-label="Plans" className="divide-y divide-line rounded-control border border-line">
                {view.plans.map((plan) => (
                  <li key={plan.key} className="flex min-w-0 items-center gap-2 px-3 py-2">
                    {plan.platform ? <Badge className="w-14 justify-center">{plan.platform}</Badge> : null}
                    <span title={plan.title} className="min-w-0 flex-1 truncate text-small text-fg">
                      {plan.title}
                    </span>
                    <span className="flex-none whitespace-nowrap font-mono text-mono text-fg-subtle">{plan.size}</span>
                    <span className="w-14 flex-none whitespace-nowrap text-right font-mono text-mono text-fg-subtle">{plan.age}</span>
                  </li>
                ))}
              </ul>
              {view.plansMore ? <p className="text-caption text-fg-subtle">{view.plansMore}</p> : null}
            </>
          ) : (
            <p className="text-small text-fg-muted">{view.plansEmpty}</p>
          )}
        </div>
      </div>
    </Section>
  );
}
