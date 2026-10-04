import { sectionStackLayoutVariants } from './SectionStackLayout.variants';
import type { SectionStackLayoutProps } from './types';

export function SectionStackLayout({ title, children, spacing }: SectionStackLayoutProps) {
  return (
    <section className="flex min-w-0 flex-col gap-3">
      {title}
      <div className={sectionStackLayoutVariants({ spacing })}>{children}</div>
    </section>
  );
}
