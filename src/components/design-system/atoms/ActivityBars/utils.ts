// `rest` is the still height each bar keeps under reduced motion.
export const ACTIVITY_BARS = [
  { delay: '0ms', rest: 'motion-reduce:scale-y-50' },
  { delay: '150ms', rest: 'motion-reduce:scale-y-100' },
  { delay: '300ms', rest: 'motion-reduce:scale-y-75' },
] as const;
