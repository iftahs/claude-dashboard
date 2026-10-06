import { memo } from 'react';
import { KeyValueRow } from '@/components/design-system/molecules/KeyValueRow/KeyValueRow';
import { MeterRow } from '@/components/design-system/molecules/MeterRow/MeterRow';
import { Section } from '@/components/design-system/organisms/Section/Section';
import type { ExtraUsageCardProps } from './types';
import { headlineNote, headlineValue } from './utils';

export const ExtraUsageCard = memo(function ExtraUsageCard({ view, className }: ExtraUsageCardProps) {
  const { usage, rows, disclaimer } = view;
  const shown = view.enabled && usage ? usage : null;

  return (
    <Section title={view.title} help={view.help} as="h3" className={className}>
      <div className="flex flex-col gap-3">
        {shown && shown.pct !== null ? (
          <MeterRow
            label={shown.label}
            value={headlineValue(shown)}
            percent={shown.pct}
            tone={shown.tone}
            note={headlineNote(shown.pct)}
          />
        ) : null}
        {shown && shown.pct === null ? <KeyValueRow label={shown.label} value={headlineValue(shown)} /> : null}
        {shown ? null : <p className="text-small text-fg-muted">{view.disabledCopy}</p>}

        {rows && rows.length > 0 ? (
          <div className="flex flex-col gap-2">
            {rows.map((row) => (
              <KeyValueRow key={row.label} label={row.label} value={row.value} tone={row.tone === 'danger' ? 'danger' : 'muted'} />
            ))}
          </div>
        ) : null}

        {disclaimer ? (
          <p className="text-caption text-fg-subtle">
            {disclaimer.text}
            {disclaimer.text && disclaimer.href ? ' ' : null}
            {disclaimer.href && disclaimer.linkText ? (
              <a
                href={disclaimer.href}
                target="_blank"
                rel="noreferrer"
                className="rounded-tag underline outline-none hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                {disclaimer.linkText}
              </a>
            ) : null}
          </p>
        ) : null}
      </div>
    </Section>
  );
});
