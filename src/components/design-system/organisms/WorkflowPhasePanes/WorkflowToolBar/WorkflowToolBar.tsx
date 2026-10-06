import { ProgressBar } from '@/components/design-system/atoms/ProgressBar/ProgressBar';
import { toolBarLabel } from '../utils';
import type { WorkflowToolBarProps } from './types';

export function WorkflowToolBar({ tool }: WorkflowToolBarProps) {
  return (
    <li className="flex min-w-0 items-center gap-3">
      <span title={tool.name} className="w-28 flex-none truncate font-mono text-mono text-fg-muted sm:w-40">
        {tool.label}
      </span>
      <ProgressBar
        value={tool.percent}
        tone="neutral"
        size="sm"
        label={toolBarLabel(tool.label, tool.count, tool.failed)}
        className="min-w-0 flex-1"
      />
      <span className="w-8 flex-none text-right font-mono text-mono tabular-nums text-fg">{tool.count}</span>
      <span className="w-16 flex-none whitespace-nowrap text-right font-mono text-mono tabular-nums text-danger-fg">{tool.failed}</span>
    </li>
  );
}
