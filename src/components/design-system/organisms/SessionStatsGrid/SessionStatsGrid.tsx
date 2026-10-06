import { memo } from 'react';
import { Card } from '@/components/design-system/atoms/Card/Card';
import { ErrorState } from '@/components/design-system/molecules/ErrorState/ErrorState';
import { SkeletonPreset } from '@/components/design-system/molecules/SkeletonPreset/SkeletonPreset';
import { StatTile } from '@/components/design-system/molecules/StatTile/StatTile';
import type { SessionStatsGridProps } from './types';
import { SKELETON_TILES } from './utils';

export const SessionStatsGrid = memo(function SessionStatsGrid({ view }: SessionStatsGridProps) {
  if (view.status === 'error') {
    return (
      <Card as="div" className="col-span-full">
        <ErrorState title={view.errorTitle} description={view.errorDescription} className="py-6" />
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
          help={tile.help}
          sub={
            <>
              <span dir="auto" title={tile.sub} className="block truncate text-left">
                {tile.sub}
              </span>
              {tile.split ? (
                <span title={tile.split} className="block truncate text-fg-subtle">
                  {tile.split}
                </span>
              ) : null}
            </>
          }
        />
      ))}
    </>
  );
});
