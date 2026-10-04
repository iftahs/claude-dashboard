const token = (name: string) => `rgb(var(--${name}))`;

export const CHART_GRID = { stroke: token('chart-grid'), vertical: false } as const;

export const CHART_AXIS_TICK = { fill: token('chart-axis'), fontSize: 12 } as const;

export const CHART_AXIS = { tick: CHART_AXIS_TICK, axisLine: false, tickLine: false } as const;

export const CHART_CURSOR = { fill: token('chart-cursor') } as const;

export const CHART_BAR_RADIUS: [number, number, number, number] = [4, 4, 0, 0];

export const PLATFORM_COLORS = {
  claude: token('platform-claude'),
  codex: token('platform-codex'),
} as const;
