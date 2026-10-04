import { cn } from '@/lib/cn';
import { tableRowVariants } from './TableRow.variants';
import type { TableRowProps } from './types';

export function TableRow({ state, interactive, className, ...props }: TableRowProps) {
  return <tr className={cn(tableRowVariants({ state, interactive }), className)} {...props} />;
}
