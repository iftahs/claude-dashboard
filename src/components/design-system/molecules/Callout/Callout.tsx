import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { cn } from '@/lib/cn';
import { calloutVariants } from './Callout.variants';
import type { CalloutProps } from './types';
import { CALLOUT_ICONS } from './utils';

export function Callout({ tone = 'info', title, icon, action, className, children, ...props }: CalloutProps) {
  return (
    <div role="note" className={cn(calloutVariants({ tone }), className)} {...props}>
      <Icon name={icon ?? CALLOUT_ICONS[tone]} className="mt-px" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div>{children}</div> : null}
      </div>
      {action ? <div className="flex flex-none items-center gap-2 self-center">{action}</div> : null}
    </div>
  );
}
