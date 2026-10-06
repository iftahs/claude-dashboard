import { Button } from '@/components/design-system/atoms/Button/Button';
import { Input } from '@/components/design-system/atoms/Input/Input';
import { Select } from '@/components/design-system/atoms/Select/Select';
import { FormField } from '@/components/design-system/molecules/FormField/FormField';
import { Section } from '@/components/design-system/organisms/Section/Section';
import type { AiSettingsProps } from './types';

export function AiSettings({
  id,
  view,
  onProviderChange,
  onModelChange,
  onKeyChange,
  onToggleKeyShown,
  onSaveKey,
  onClearKey,
}: AiSettingsProps) {
  return (
    <div id={id} className="scroll-mt-6">
      <Section title="AI" description="Provider, model and key for AI insights">
        <form
          aria-label="AI insights"
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSaveKey();
          }}
        >
          <p className="max-w-3xl text-small text-fg-muted">
            Powers the AI chat and the AI button on each card. Choose a provider and a model, and paste an API key. The key is stored only
            in this browser and sent to the local backend with each request — it never goes to analytics. Leave the key empty to fall back
            to a local <code className="font-mono text-code text-fg">claude</code> CLI or your Claude.ai token.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Provider" htmlFor={`${id}-provider`}>
              <Select
                ariaLabel="Provider"
                className="w-full"
                value={view.provider}
                onValueChange={onProviderChange}
                options={view.providers}
              />
            </FormField>
            <FormField label="Model" htmlFor={`${id}-model`}>
              <Select ariaLabel="Model" className="w-full" value={view.model} onValueChange={onModelChange} options={view.models} />
            </FormField>
          </div>
          <FormField label="API key" htmlFor={`${id}-key`}>
            <Input
              type={view.keyShown ? 'text' : 'password'}
              className="font-mono"
              placeholder={view.keyPlaceholder}
              autoComplete="off"
              spellCheck={false}
              value={view.key}
              onChange={(event) => onKeyChange(event.target.value)}
            />
          </FormField>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-caption text-fg-muted">{view.keySaved ? 'Key saved in this browser' : 'No key set'}</p>
            <div className="flex gap-2">
              <Button variant="ghost" aria-pressed={view.keyShown} onClick={onToggleKeyShown}>
                {view.keyShown ? 'Hide key' : 'Show key'}
              </Button>
              {view.keySaved ? (
                <Button variant="ghost" onClick={onClearKey}>
                  Clear
                </Button>
              ) : null}
              <Button type="submit" variant="primary">
                Save key
              </Button>
            </div>
          </div>
        </form>
      </Section>
    </div>
  );
}
