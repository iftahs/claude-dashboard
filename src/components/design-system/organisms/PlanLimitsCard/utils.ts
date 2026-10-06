import type { ForecastTone } from '@/lib/forecast';

export const ACTIVE_LABEL = 'Active';
export const ESTIMATE_LABEL = 'Estimate';
export const SURFACE_CAPTION = "Share of this week's usage";
export const SURFACE_LEGEND_LABEL = "Share of this week's usage by surface";
export const SURFACE_HELP_LABEL = 'About the share by surface';

export const FORECAST_CLASS: Record<ForecastTone, string> = {
  danger: 'text-danger-fg',
  warning: 'text-warning-fg',
  neutral: 'text-fg-muted',
};
