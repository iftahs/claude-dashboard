import { splitLayoutVariants } from './SplitLayout.variants';
import type { SplitLayoutProps } from './types';

export function SplitLayout({ children, columns, ratio, gap, collapseBelow }: SplitLayoutProps) {
  return <div className={splitLayoutVariants({ columns, ratio, gap, collapseBelow })}>{children}</div>;
}
