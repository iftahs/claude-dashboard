const token = (name: string) => `rgb(var(--${name}))`;

export const CHART_GRID = { stroke: token('chart-grid'), vertical: false } as const;

export const CHART_AXIS_TICK = { fill: token('chart-axis'), fontSize: 12 } as const;

export const CHART_AXIS = { tick: CHART_AXIS_TICK, axisLine: false, tickLine: false } as const;

export const CHART_CURSOR = { fill: token('chart-cursor') } as const;

export const CHART_BAR_RADIUS: [number, number, number, number] = [4, 4, 0, 0];

export const CHART_TODAY_LINE = { stroke: token('accent'), strokeDasharray: '4 3', strokeOpacity: 0.5 } as const;

export const CHART_TODAY_LABEL = { fill: token('accent-fg'), fontSize: 12, position: 'insideTopRight' } as const;

export const CHART_PROJECTED_FILL = 'rgb(var(--fg-subtle) / 0.25)';

export const CHART_LINE_CURSOR = { stroke: token('chart-cursor'), strokeWidth: 1 } as const;

export const CHART_LINE_WIDTH = 2;

export const CHART_ACTIVE_DOT_STROKE = token('surface');

export const CHART_REFERENCE_LINE = { strokeDasharray: '4 3', strokeOpacity: 0.5 } as const;

export const CHART_REFERENCE_LABEL = { fill: token('chart-axis'), fontSize: 12, position: 'insideTopRight' } as const;

export const PLATFORM_COLORS = {
  claude: token('platform-claude'),
  codex: token('platform-codex'),
} as const;
