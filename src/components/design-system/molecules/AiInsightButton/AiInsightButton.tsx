import { Button } from '@/components/design-system/atoms/Button/Button';
import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { Tooltip } from '@/components/design-system/atoms/Tooltip/Tooltip';
import { cn } from '@/lib/cn';
import type { AiInsightButtonProps } from './types';

export function AiInsightButton({
  onClick,
  loading = false,
  label = 'Explain this section with AI',
  className,
}: AiInsightButtonProps) {
  return (
    <Tooltip content={label}>
      <Button
        variant="ghost"
        size="sm"
        aria-label={label}
        aria-busy={loading || undefined}
        disabled={loading}
        onClick={onClick}
        className={className}
      >
        <Icon name="sparkles" size={14} className={cn(loading && 'animate-pulse motion-reduce:animate-none')} />
        {loading ? 'Thinking' : 'AI'}
      </Button>
    </Tooltip>
  );
}
