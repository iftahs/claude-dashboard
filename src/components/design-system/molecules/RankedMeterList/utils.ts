import type { RankedMeterLabelWidth } from './types';

const LABEL_CAP: Record<RankedMeterLabelWidth, string> = { sm: '6rem', md: '9rem', lg: '13rem' };
const BAR_TRACK = 'minmax(2.5rem, 1fr)';

export function gridTemplate(labelWidth: RankedMeterLabelWidth, secondary: boolean): string {
  return `fit-content(${LABEL_CAP[labelWidth]}) ${BAR_TRACK} auto${secondary ? ' auto' : ''}`;
}
