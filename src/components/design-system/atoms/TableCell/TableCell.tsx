import { cn } from '@/lib/cn';
import { tableCellVariants } from './TableCell.variants';
import type { TableCellProps } from './types';

export function TableCell({ header = false, align, numeric = false, truncate = false, className, ...props }: TableCellProps) {
  const Tag = header ? 'th' : 'td';
  const resolvedAlign = align ?? (numeric ? 'right' : 'left');

  return (
    <Tag
      scope={header ? 'col' : undefined}
      className={cn(tableCellVariants({ header, align: resolvedAlign, numeric, truncate }), className)}
      {...props}
    />
  );
}
