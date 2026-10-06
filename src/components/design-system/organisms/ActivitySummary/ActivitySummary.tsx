import { memo } from 'react';
import { Card } from '@/components/design-system/atoms/Card/Card';
import { ErrorState } from '@/components/design-system/molecules/ErrorState/ErrorState';
import { SkeletonPreset } from '@/components/design-system/molecules/SkeletonPreset/SkeletonPreset';
import { StatTile } from '@/components/design-system/molecules/StatTile/StatTile';
import type { ActivitySummaryProps } from './types';
import { SKELETON_TILES } from './utils';

export const ActivitySummary = memo(function ActivitySummary({ view }: ActivitySummaryProps) {
  if (view.status === 'hidden') return null;

  if (view.status === 'error') {
    return (
      <Card as="div" className="col-span-full">
        <ErrorState title={view.message?.title ?? ''} description={view.message?.description} className="py-6" />
      </Card>
    );
  }

  if (view.status === 'loading') {
    return (
      <>
        {SKELETON_TILES.map((index) => (
          <Card key={index} as="div" padding="sm">
            <SkeletonPreset variant="stat" />
          </Card>
        ))}
      </>
    );
  }

  return (
    <>
      {view.tiles.map((tile) => (
        <StatTile
          key={tile.key}
          label={tile.label}
          value={tile.value}
          tone={tile.tone}
          help={tile.help}
          sub={
            tile.lines.length > 0 ? (
              <span className="flex min-w-0 flex-col gap-0.5">
                {tile.lines.map((line) =>
                  typeof line === 'string' ? (
                    <span key={line} title={line} className="truncate">
                      {line}
                    </span>
                  ) : (
                    <span key={line.join()} className="flex min-w-0 flex-wrap gap-x-2 gap-y-0.5">
                      {line.map((part) => (
                        <span key={part} title={part} className="truncate">
                          {part}
                        </span>
                      ))}
                    </span>
                  ),
                )}
              </span>
            ) : undefined
          }
        />
      ))}
    </>
  );
});
