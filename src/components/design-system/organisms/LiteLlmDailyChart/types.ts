export interface LiteLlmDay {
  date: string;
  cost: number;
  requests: number;
  successful: number;
  byModel: Record<string, number>;
}

export interface LiteLlmDailyChartProps {
  days: LiteLlmDay[];
}

export interface LiteLlmDailyTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      full: string;
      label: string;
      cost: number;
      requests: number;
      successful: number;
      byModel: Record<string, number>;
      isToday: boolean;
    };
  }>;
}
