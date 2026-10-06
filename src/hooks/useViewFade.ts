import { useCallback, useState } from 'react';
import type { AnimationEvent } from 'react';

export interface ViewFade {
  className: string | undefined;
  onAnimationEnd: (event: AnimationEvent<HTMLElement>) => void;
}

// The panel shown after a view switch fades in once; a page's first panel enters with the page instead.
export function useViewFade(view: string): ViewFade {
  const [shown, setShown] = useState(view);
  const [fading, setFading] = useState<string | null>(null);
  if (shown !== view) {
    setShown(view);
    setFading(view);
  }

  const onAnimationEnd = useCallback((event: AnimationEvent<HTMLElement>) => {
    if (event.target === event.currentTarget) setFading(null);
  }, []);

  return { className: fading === view ? 'animate-fade-in' : undefined, onAnimationEnd };
}
