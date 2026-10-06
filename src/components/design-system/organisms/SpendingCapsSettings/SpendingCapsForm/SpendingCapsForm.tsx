import { Button } from '@/components/design-system/atoms/Button/Button';
import { Input } from '@/components/design-system/atoms/Input/Input';
import { FormField } from '@/components/design-system/molecules/FormField/FormField';
import type { SpendingCapsFormProps } from './types';

export function SpendingCapsForm({ idPrefix, group, onChange, onSave, onClear }: SpendingCapsFormProps) {
  const label = group.heading ? `${group.heading} spending caps` : 'Spending caps';

  return (
    <form
      aria-label={label}
      className="flex min-w-0 flex-col gap-4 py-4 first:pt-0 last:pb-0"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      {group.heading ? <h3 className="text-small font-medium text-fg">{group.heading}</h3> : null}
      <div className="grid gap-4 md:grid-cols-3">
        {group.fields.map((field) => (
          <FormField key={field.key} label={field.label} htmlFor={`${idPrefix}-${group.key}-${field.key}`}>
            <Input
              inputMode="decimal"
              autoComplete="off"
              placeholder={field.placeholder}
              value={field.value}
              onChange={(event) => onChange(field.key, event.target.value)}
            />
          </FormField>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClear}>
          Clear
        </Button>
        <Button type="submit" variant="primary">
          Save
        </Button>
      </div>
    </form>
  );
}
