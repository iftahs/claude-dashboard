import type { CostCalculationView, PricePlatform, TokenField } from '@/lib/views/models';

export interface CostCalculationProps {
  view: CostCalculationView;
  onSelectModel: (name: string) => void;
  onToggleGroup: (group: PricePlatform) => void;
  onTokensChange: (field: TokenField, value: string) => void;
  onReset: () => void;
  className?: string;
}
