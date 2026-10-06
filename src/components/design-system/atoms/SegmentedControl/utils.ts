import type { SegmentedControlThumb } from './types';

export function sameThumb(a: SegmentedControlThumb | null, b: SegmentedControlThumb | null): boolean {
  return a === b || (a !== null && b !== null && a.left === b.left && a.width === b.width);
}
