import { Card } from '@/components/design-system/atoms/Card/Card';
import { InfoTip } from '@/components/design-system/atoms/InfoTip/InfoTip';
import { cn } from '@/lib/cn';
import { statTileValueVariants, statTileVariants } from './StatTile.variants';
import type { StatTileProps } from './types';

export function StatTile({ label, value, sub, tone, help, size, className }: StatTileProps) {
  return (
    <Card as="div" padding="sm" className={cn(statTileVariants({ size }), className)}>
      <div className="flex min-w-0 items-center gap-1">
        <span title={label} className="min-w-0 truncate text-label uppercase text-fg-subtle">
          {label}
        </span>
        {help ? <InfoTip label={`About ${label}`} content={help} /> : null}
      </div>
      <span className={statTileValueVariants({ tone, size })}>{value}</span>
      {sub ? (
        <span title={typeof sub === 'string' ? sub : undefined} className="truncate text-caption text-fg-muted">
          {sub}
        </span>
      ) : null}
    </Card>
  );
}
