import { InfoTip } from '@/components/design-system/atoms/InfoTip/InfoTip';
import { cn } from '@/lib/cn';
import type { CardHeaderProps } from './types';

export function CardHeader({ title, description, help, actions, as: Tag = 'h2', titleId, className }: CardHeaderProps) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <Tag id={titleId} className="min-w-0 text-heading text-fg">
            {title}
          </Tag>
          {help ? <InfoTip label={`About ${title}`} content={help} /> : null}
        </div>
        {description ? <p className="mt-0.5 text-small text-fg-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-none items-center gap-2">{actions}</div> : null}
    </div>
  );
}
