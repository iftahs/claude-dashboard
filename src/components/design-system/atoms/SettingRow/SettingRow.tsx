import { cn } from '@/lib/cn';
import { settingRowControlVariants, settingRowVariants } from './SettingRow.variants';
import type { SettingRowProps } from './types';

export function SettingRow({ title, description, children, below, layout, className }: SettingRowProps) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-3 py-4 first:pt-0 last:pb-0', className)}>
      <div className={settingRowVariants({ layout })}>
        <div className="flex min-w-0 flex-col gap-1 md:max-w-xl md:flex-1">
          <h3 className="text-small font-medium text-fg">{title}</h3>
          {description ? <p className="text-caption text-fg-muted">{description}</p> : null}
        </div>
        {children ? <div className={settingRowControlVariants({ layout })}>{children}</div> : null}
      </div>
      {below}
    </div>
  );
}
