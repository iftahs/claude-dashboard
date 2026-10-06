import { memo, useId } from 'react';
import { Button } from '@/components/design-system/atoms/Button/Button';
import { GroupLabel } from '@/components/design-system/atoms/GroupLabel/GroupLabel';
import { Input } from '@/components/design-system/atoms/Input/Input';
import { Select } from '@/components/design-system/atoms/Select/Select';
import { Callout } from '@/components/design-system/molecules/Callout/Callout';
import { FormField } from '@/components/design-system/molecules/FormField/FormField';
import { Section } from '@/components/design-system/organisms/Section/Section';
import { PriceTable } from './PriceTable/PriceTable';
import type { CostCalculationProps } from './types';
import { CALCULATOR_HINT, CALCULATOR_LABEL, COST_LABEL, MODEL_LABEL, RESET_LABEL } from './utils';

export const CostCalculation = memo(function CostCalculation({
  view,
  onSelectModel,
  onToggleGroup,
  onTokensChange,
  onReset,
  className,
}: CostCalculationProps) {
  const id = useId();

  return (
    <Section title={view.title} description={view.description} help={view.help} as="h3" className={className}>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-5 xl:col-span-7">
          {view.groups.map((group) => (
            <PriceTable key={group.key} group={group} onSelectModel={onSelectModel} onToggleGroup={onToggleGroup} />
          ))}
          <Callout tone="neutral" title={view.cachingTitle}>
            {view.cachingNote}
          </Callout>
        </div>

        <div className="flex min-w-0 flex-col gap-4 rounded-control bg-surface-sunken p-4 xl:col-span-5 xl:self-start">
          <div className="flex items-center justify-between gap-3">
            <GroupLabel as="span">{CALCULATOR_LABEL}</GroupLabel>
            <Button size="sm" onClick={onReset}>
              {RESET_LABEL}
            </Button>
          </div>
          <p className="text-small text-fg-muted">{CALCULATOR_HINT}</p>

          <FormField label={MODEL_LABEL} htmlFor={`${id}-model`}>
            <Select
              ariaLabel={MODEL_LABEL}
              className="w-full"
              value={view.selected}
              onValueChange={onSelectModel}
              options={view.modelOptions}
            />
          </FormField>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {view.fields.map((field) => (
              <FormField key={field.key} label={field.label} htmlFor={`${id}-${field.key}`} helper={field.helper}>
                <Input
                  inputMode="numeric"
                  autoComplete="off"
                  className="font-mono"
                  value={field.value}
                  onChange={(event) => onTokensChange(field.key, event.target.value)}
                />
              </FormField>
            ))}
          </div>

          <div className="flex flex-col gap-3 border-t border-line pt-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-small text-fg-muted">{COST_LABEL}</span>
              <output className="whitespace-nowrap text-metric tabular-nums text-fg">
                {view.cost}
              </output>
            </div>
            <div className="overflow-x-auto rounded-control border border-line bg-surface px-3 py-2 font-mono text-mono text-fg-muted">
              {view.formula.map((line) => (
                <div key={line} className="whitespace-nowrap">
                  {line}
                </div>
              ))}
              <div className="mt-1 whitespace-nowrap border-t border-line pt-1 text-fg">{view.formulaTotal}</div>
            </div>
            {view.modelNote ? <p className="text-caption text-fg-subtle">{view.modelNote}</p> : null}
          </div>
        </div>
      </div>
    </Section>
  );
});
