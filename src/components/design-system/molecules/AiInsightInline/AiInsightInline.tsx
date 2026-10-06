import { GroupLabel } from '@/components/design-system/atoms/GroupLabel/GroupLabel';
import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { IconButton } from '@/components/design-system/atoms/IconButton/IconButton';
import { Markdown } from '@/components/design-system/atoms/Markdown/Markdown';
import { Skeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
import { Tooltip } from '@/components/design-system/atoms/Tooltip/Tooltip';
import { cn } from '@/lib/cn';
import type { AiInsightInlineProps } from './types';
import { LOADING_LINE_WIDTHS } from './utils';

export function AiInsightInline({ onDismiss, text, loading = false, error, backendLabel, className }: AiInsightInlineProps) {
  return (
    <div className={cn('min-w-0 rounded-control border border-line bg-surface-sunken py-2 pl-3 pr-2', className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-1.5 text-fg-subtle">
          <Icon name="sparkles" size={14} />
          <GroupLabel as="span" note={backendLabel}>
            AI insight
          </GroupLabel>
        </div>
        <Tooltip content="Dismiss">
          <IconButton size="sm" label="Dismiss AI insight" onClick={onDismiss}>
            <Icon name="x" size={14} />
          </IconButton>
        </Tooltip>
      </div>
      <div aria-live="polite" aria-busy={loading} className="pb-1 pr-1 pt-1">
        {loading ? (
          <>
            <span className="sr-only">Analyzing this section</span>
            <div className="flex flex-col gap-2 py-1.5">
              {LOADING_LINE_WIDTHS.map((width, index) => (
                <Skeleton key={index} width={width} height={8} className="bg-line" />
              ))}
            </div>
          </>
        ) : error ? (
          <p className="text-small text-danger-fg">{error}</p>
        ) : (
          <Markdown text={text ?? ''} />
        )}
      </div>
    </div>
  );
}
