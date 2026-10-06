import { memo } from 'react';
import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import { Card } from '@/components/design-system/atoms/Card/Card';
import { Icon } from '@/components/design-system/atoms/Icon/Icon';
import { IconButton } from '@/components/design-system/atoms/IconButton/IconButton';
import { Input } from '@/components/design-system/atoms/Input/Input';
import { Callout } from '@/components/design-system/molecules/Callout/Callout';
import { SkeletonPreset } from '@/components/design-system/molecules/SkeletonPreset/SkeletonPreset';
import { cn } from '@/lib/cn';
import type { SessionSearchStripProps } from './types';
import { CLEAR_LABEL, HIT_CLASS, RESULTS_LABEL, SKELETON_ROWS } from './utils';

export const SessionSearchStrip = memo(function SessionSearchStrip({ view, onQueryChange, onOpen, className }: SessionSearchStripProps) {
  return (
    <div role="search" className={cn('flex min-w-0 flex-col gap-3', className)}>
      <div className="relative min-w-0">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-fg-subtle">
          <Icon name="search" />
        </span>
        <Input
          type="text"
          inputMode="search"
          autoComplete="off"
          spellCheck={false}
          aria-label={view.label}
          placeholder={view.placeholder}
          value={view.query}
          onChange={(event) => onQueryChange(event.target.value)}
          className="px-9"
        />
        {view.query ? (
          <span className="absolute inset-y-0 right-0.5 flex items-center">
            <IconButton label={CLEAR_LABEL} size="sm" onClick={() => onQueryChange('')}>
              <Icon name="x" />
            </IconButton>
          </span>
        ) : null}
      </div>

      {view.status === 'loading' ? (
        <Card as="div" padding="sm">
          <SkeletonPreset variant="text" rows={SKELETON_ROWS} />
        </Card>
      ) : null}

      {view.status === 'error' ? (
        <Callout tone="danger" role="alert">
          {view.summary}
        </Callout>
      ) : null}

      {view.status === 'empty' ? (
        <Callout tone="neutral" icon="search" role="status">
          {view.summary}
        </Callout>
      ) : null}

      {view.status === 'ready' ? (
        <Card aria-label={RESULTS_LABEL} padding="none" className="overflow-hidden">
          <p role="status" className="bg-surface-sunken px-4 py-2 text-label uppercase text-fg-subtle">
            {view.summary}
          </p>
          <ul className="min-w-0 divide-y divide-line border-t border-line">
            {view.hits.map((hit) => (
              <li key={hit.id} className="min-w-0">
                <button type="button" onClick={() => onOpen(hit.id)} className={HIT_CLASS}>
                  <span className="flex min-w-0 items-center gap-2">
                    <span dir="auto" title={hit.headline} className="min-w-0 truncate text-body font-medium text-fg">
                      {hit.headline}
                    </span>
                    {hit.project ? (
                      <span dir="auto" title={hit.project} className="max-w-[40%] flex-none truncate text-small text-fg-muted">
                        {hit.project}
                      </span>
                    ) : null}
                    {hit.badge ? <Badge tone="info">{hit.badge}</Badge> : null}
                    <span className="flex-none whitespace-nowrap font-mono text-mono text-fg-subtle">{hit.date}</span>
                    {hit.matches ? <span className="flex-none whitespace-nowrap text-caption text-accent-fg">{hit.matches}</span> : null}
                  </span>
                  {hit.snippet ? (
                    <span dir="auto" className="min-w-0 truncate text-small text-fg-muted">
                      {hit.snippet}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
});
