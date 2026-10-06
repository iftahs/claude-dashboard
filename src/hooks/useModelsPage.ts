import { useCallback, useMemo, useState } from 'react';
import { useAiInsightCtx } from './useAiInsightContext';
import { useLiveData } from './useLiveData';
import { usePolling } from './usePolling';
import { useSource } from './useSource';
import {
  DEFAULT_TOKEN_INPUTS,
  MODELS_DESCRIPTION,
  PRICING_DATA,
  buildCostCalculation,
  buildEffortBreakdown,
  buildModelBreakdown,
  isHeadlinePrice,
  priceGroups,
  sanitizeTokenInput,
  selectedPrice,
  type CostCalculationView,
  type EffortBreakdownView,
  type ExpandedGroups,
  type ModelBreakdownView,
  type PricePlatform,
  type TokenField,
  type TokenInputs,
} from '@/lib/views/models';
import type { EffortData } from '@/types';

export interface ModelsPageView {
  description: string;
  breakdown: ModelBreakdownView;
  effort: EffortBreakdownView;
  pricing: CostCalculationView;
  onSelectModel: (name: string) => void;
  onTogglePriceGroup: (group: PricePlatform) => void;
  onTokensChange: (field: TokenField, value: string) => void;
  onResetCalculator: () => void;
}

export function useModelsPage(): ModelsPageView {
  const { platform, withSrc } = useSource();
  const { models } = useLiveData();
  const { sectionAi } = useAiInsightCtx();
  const effort = usePolling<EffortData>(withSrc('/api/usage/effort?days=7'), 30000);

  const modelsAi = useMemo(() => sectionAi('models', models.data), [sectionAi, models.data]);
  const breakdown = useMemo(
    () => buildModelBreakdown({ poll: { data: models.data, loading: models.loading, error: models.error }, platform, ai: modelsAi }),
    [models.data, models.loading, models.error, platform, modelsAi],
  );

  const effortView = useMemo(
    () => buildEffortBreakdown({ poll: { data: effort.data, loading: effort.loading, error: effort.error }, platform }),
    [effort.data, effort.loading, effort.error, platform],
  );

  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<ExpandedGroups>({});
  const [inputs, setInputs] = useState<TokenInputs>(DEFAULT_TOKEN_INPUTS);

  const groups = useMemo(() => priceGroups(platform), [platform]);
  // A platform switch can hide the picked model; the calculator then prices the first row of the leading rate card.
  const selected = useMemo(() => selectedPrice(groups, selectedName), [groups, selectedName]);
  const pricing = useMemo(
    () => buildCostCalculation({ platform, groups, selected, expanded, inputs }),
    [platform, groups, selected, expanded, inputs],
  );

  const onSelectModel = useCallback((name: string) => {
    setSelectedName(name);
    const model = PRICING_DATA.find((entry) => entry.name === name);
    if (model && !isHeadlinePrice(model)) {
      setExpanded((current) => (current[model.platform] ? current : { ...current, [model.platform]: true }));
    }
  }, []);

  const onTogglePriceGroup = useCallback((group: PricePlatform) => {
    setExpanded((current) => ({ ...current, [group]: !current[group] }));
  }, []);

  const onTokensChange = useCallback((field: TokenField, value: string) => {
    setInputs((current) => ({ ...current, [field]: sanitizeTokenInput(value) }));
  }, []);

  const onResetCalculator = useCallback(() => setInputs(DEFAULT_TOKEN_INPUTS), []);

  return {
    description: MODELS_DESCRIPTION[platform],
    breakdown,
    effort: effortView,
    pricing,
    onSelectModel,
    onTogglePriceGroup,
    onTokensChange,
    onResetCalculator,
  };
}
