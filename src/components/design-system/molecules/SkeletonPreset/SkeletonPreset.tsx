import { Skeleton } from '@/components/design-system/atoms/Skeleton/Skeleton';
import { cn } from '@/lib/cn';
import { skeletonPresetShapeVariants, skeletonPresetVariants } from './SkeletonPreset.variants';
import type { SkeletonPresetProps } from './types';
import { TABLE_NUMERIC_COLUMNS, chartBarHeight, labelWidth, rowIndexes, textLineWidth } from './utils';

export function SkeletonPreset({ variant, rows, className }: SkeletonPresetProps) {
  const items = rowIndexes(variant, rows);

  return (
    <div role="status" className={cn(skeletonPresetVariants({ variant }), className)}>
      <span className="sr-only">Loading</span>
      <div aria-hidden="true" className={skeletonPresetShapeVariants({ variant })}>
        {variant === 'text' ? (
          <>
            <Skeleton width="40%" height={14} />
            {items.map((index) => (
              <Skeleton key={index} width={textLineWidth(index, items.length)} height={8} />
            ))}
          </>
        ) : null}

        {variant === 'stat' ? (
          <>
            <Skeleton className="my-0.5 h-3 w-20" />
            <Skeleton className="my-0.5 h-5 w-24" />
            <Skeleton className="my-0.5 h-3 w-28" />
          </>
        ) : null}

        {variant === 'chart'
          ? items.map((index) => <Skeleton key={index} height={chartBarHeight(index)} className="min-w-0 flex-1 rounded-[2px]" />)
          : null}

        {variant === 'bars'
          ? items.map((index) => (
              <div key={index} className="flex flex-col gap-1.5">
                <div className="flex h-5 items-center justify-between gap-3">
                  <Skeleton width={labelWidth(index)} height={12} />
                  <Skeleton className="h-3 w-10 flex-none" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            ))
          : null}

        {variant === 'table' ? (
          <>
            <div className="flex h-9 items-center gap-4 bg-surface-sunken px-4">
              <div className="min-w-0 flex-1">
                <Skeleton className="h-3 w-16" />
              </div>
              {TABLE_NUMERIC_COLUMNS.map((column) => (
                <Skeleton key={column} className="h-3 w-12 flex-none" />
              ))}
            </div>
            {items.map((index) => (
              <div key={index} className="flex h-10 items-center gap-4 border-t border-line px-4">
                <div className="min-w-0 flex-1">
                  <Skeleton width={labelWidth(index)} height={12} />
                </div>
                {TABLE_NUMERIC_COLUMNS.map((column) => (
                  <Skeleton key={column} className="h-3 w-12 flex-none" />
                ))}
              </div>
            ))}
          </>
        ) : null}

        {variant === 'gauge'
          ? items.map((index) => (
              <div key={index} className="flex flex-col gap-2">
                <div className="flex h-6 items-center justify-between gap-3">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-5 w-12 flex-none" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
                <Skeleton className="my-0.5 h-3 w-40" />
              </div>
            ))
          : null}
      </div>
    </div>
  );
}
