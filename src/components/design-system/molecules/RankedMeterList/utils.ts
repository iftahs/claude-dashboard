import type { RankedMeterLabelWidth } from './types';

const LABEL_CAP: Record<RankedMeterLabelWidth, string> = {
  sm: 'min(6rem, 40%)',
  md: 'min(9rem, 45%)',
  lg: 'min(13rem, 55%)',
  xl: 'min(18rem, 62%)',
};
const BAR_TRACK = 'minmax(2.5rem, 1fr)';

export function gridTemplate(labelWidth: RankedMeterLabelWidth, secondary: boolean): string {
  return `fit-content(${LABEL_CAP[labelWidth]}) ${BAR_TRACK} auto${secondary ? ' auto' : ''}`;
}
