import type { TopbarDensity } from './types';

export const ROOMY: TopbarDensity = {
  gap: 'gap-1.5 lg:gap-2 xl:gap-3',
  divider: 'hidden xl:block',
  jumpLabel: 'hidden xl:inline',
  shortcut: 'hidden md:inline-flex',
};

export const TIGHT: TopbarDensity = {
  gap: 'gap-1 lg:gap-1.5 xl:gap-2 2xl:gap-3',
  divider: 'hidden 2xl:block',
  jumpLabel: 'hidden 2xl:inline',
  shortcut: 'hidden xl:inline-flex',
  liveCaption: 'max-xl:sr-only',
};
