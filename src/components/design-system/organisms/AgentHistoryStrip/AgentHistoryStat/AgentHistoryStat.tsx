import type { AgentHistoryStatProps } from './types';

export function AgentHistoryStat({ stat }: AgentHistoryStatProps) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <dt className="flex min-w-0 flex-col">
        <span title={stat.label} className="truncate text-body text-fg">
          {stat.label}
        </span>
        <span title={stat.sub} className="truncate text-caption text-fg-subtle">
          {stat.sub}
        </span>
      </dt>
      <dd className="flex-none whitespace-nowrap text-metric tabular-nums text-fg">{stat.value}</dd>
    </div>
  );
}
