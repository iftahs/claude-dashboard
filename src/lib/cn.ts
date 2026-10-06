import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Without this, tailwind-merge reads the custom `text-body` sizes as text colours and drops one of the two.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['caption', 'label', 'small', 'body', 'heading', 'title', 'metric', 'metric-lg', 'mono', 'code'] }],
      rounded: [{ rounded: ['tag', 'control', 'card', 'dialog'] }],
      shadow: [{ shadow: ['pop'] }],
      duration: [{ duration: ['fast', 'base', 'slow'] }],
      ease: [{ ease: ['standard', 'emphasized'] }],
      animate: [
        {
          animate: [
            'live-ping', 'sweep', 'shimmer', 'equalizer', 'rise-in', 'fade-in', 'fade-out', 'scale-in', 'scale-out',
            'slide-in-right', 'slide-out-right', 'slide-in-left', 'slide-out-left', 'grow-x',
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
