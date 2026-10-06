import { pageLayoutVariants } from './PageLayout.variants';
import type { PageLayoutProps } from './types';

export function PageLayout({ header, children, width }: PageLayoutProps) {
  return (
    <div className={pageLayoutVariants({ width })}>
      {header}
      {children}
    </div>
  );
}
