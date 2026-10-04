import { statGridLayoutVariants } from './StatGridLayout.variants';
import type { StatGridLayoutProps } from './types';

export function StatGridLayout({ children, columns }: StatGridLayoutProps) {
  return <div className={statGridLayoutVariants({ columns })}>{children}</div>;
}
