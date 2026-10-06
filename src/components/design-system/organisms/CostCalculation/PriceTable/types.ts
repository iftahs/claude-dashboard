import type { PriceGroupView, PricePlatform } from '@/lib/views/models';

export interface PriceTableProps {
  group: PriceGroupView;
  onSelectModel: (name: string) => void;
  onToggleGroup: (group: PricePlatform) => void;
}
