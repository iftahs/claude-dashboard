import { useEffect, useState } from 'react';
import { Button } from '@/components/design-system/atoms/Button/Button';
import { Card } from '@/components/design-system/atoms/Card/Card';
import { AiInsightButton } from '@/components/design-system/molecules/AiInsightButton/AiInsightButton';
import { AiInsightInline } from '@/components/design-system/molecules/AiInsightInline/AiInsightInline';
import { Callout } from '@/components/design-system/molecules/Callout/Callout';
import { KeyValueRow } from '@/components/design-system/molecules/KeyValueRow/KeyValueRow';
import { Legend } from '@/components/design-system/molecules/Legend/Legend';
import { ModelChip } from '@/components/design-system/molecules/ModelChip/ModelChip';
import { SplitLayout } from '@/components/design-system/templates/SplitLayout/SplitLayout';
import { Specimen } from '../Specimen/Specimen';
import type { AskState } from '../types';
import {
  AI_ANSWER_DELAY_MS,
  AI_ERROR_SAMPLE,
  AI_INSIGHT_SAMPLE,
  CALLOUTS,
  CHIP_MODELS,
  MODEL_LEGEND,
  PLATFORM_LEGEND,
  TONED_FACTS,
  WINDOW_FACTS,
} from '../utils';

export function SectionParts() {
  const [ask, setAsk] = useState<AskState>('idle');
  const [dismissed, setDismissed] = useState(0);

  useEffect(() => {
    if (ask !== 'loading') return undefined;
    const id = setTimeout(() => setAsk('done'), AI_ANSWER_DELAY_MS);
    return () => clearTimeout(id);
  }, [ask]);

  return (
    <>
      <SplitLayout>
        <Specimen name="ModelChip" note="Fixed colour per model. No model, inherit and unknown are neutral.">
          {CHIP_MODELS.map((model) => (
            <ModelChip key={model ?? 'none'} model={model} />
          ))}
        </Specimen>
        <Specimen name="Legend" note="Wraps between entries, never inside one" layout="stack">
          <Legend ariaLabel="Tokens by model" items={MODEL_LEGEND} />
          <Legend ariaLabel="Platforms" items={PLATFORM_LEGEND} />
        </Specimen>
      </SplitLayout>
      <SplitLayout>
        <Specimen name="KeyValueRow" note="Help on the label, a tone on the value" layout="stack">
          <Card as="div" className="flex flex-col gap-2">
            {WINDOW_FACTS.map((fact) => (
              <KeyValueRow key={fact.label} label={fact.label} value={fact.value} help={fact.help} tone={fact.tone} />
            ))}
            {TONED_FACTS.map((fact) => (
              <KeyValueRow key={fact.label} label={fact.label} value={fact.value} tone={fact.tone} />
            ))}
          </Card>
        </Specimen>
        <Specimen name="Callout" note="Five tones, with and without a title, and an action" layout="stack">
          {CALLOUTS.map((callout) => (
            <Callout key={callout.tone} tone={callout.tone} title={callout.title}>
              {callout.body}
            </Callout>
          ))}
          <Callout tone="warning" title="Daily cap reached" action={<Button size="sm">Edit caps</Button>}>
            You are at $61.40 of your $60.00 cap today.
          </Callout>
        </Specimen>
      </SplitLayout>
      <SplitLayout>
        <Specimen
          name="AiInsightButton"
          note={ask === 'loading' ? 'Thinking for a moment' : ask === 'done' ? 'Answered. Ask again to repeat.' : 'Idle and busy'}
        >
          <AiInsightButton onClick={() => setAsk('loading')} loading={ask === 'loading'} />
          <AiInsightButton onClick={() => undefined} loading />
          <AiInsightButton label="Explain this chart with AI" onClick={() => setAsk('loading')} />
        </Specimen>
        <Specimen name="AiInsightInline" note={dismissed > 0 ? `Dismissed ${dismissed} times` : 'Ready, loading and failed'} layout="stack">
          <AiInsightInline text={AI_INSIGHT_SAMPLE} backendLabel="via claude -p" onDismiss={() => setDismissed((count) => count + 1)} />
          <AiInsightInline loading onDismiss={() => setDismissed((count) => count + 1)} />
          <AiInsightInline error={AI_ERROR_SAMPLE} backendLabel="via API key" onDismiss={() => setDismissed((count) => count + 1)} />
        </Specimen>
      </SplitLayout>
    </>
  );
}
