import { useEffect, useState } from 'react';
import { pageLayoutVariants } from './PageLayout.variants';
import type { PageLayoutProps } from './types';
import { ENTRANCE_MS } from './utils';

export function PageLayout({ header, children, width, entrance = true }: PageLayoutProps) {
  const [entering, setEntering] = useState(entrance);

  useEffect(() => {
    if (!entrance) return undefined;
    const timer = setTimeout(() => setEntering(false), ENTRANCE_MS);
    return () => clearTimeout(timer);
  }, [entrance]);

  return (
    <div data-entering={entering ? '' : undefined} className={pageLayoutVariants({ width })}>
      {header}
      {children}
    </div>
  );
}
