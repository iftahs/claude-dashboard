import { memo } from 'react';
import { Card } from '@/components/design-system/atoms/Card/Card';
import { ErrorState } from '@/components/design-system/molecules/ErrorState/ErrorState';
import { SkeletonPreset } from '@/components/design-system/molecules/SkeletonPreset/SkeletonPreset';
import { StatTile } from '@/components/design-system/molecules/StatTile/StatTile';
import type { InsightKpisProps } from './types';
import { SKELETON_TILES } from './utils';

export const InsightKpis = memo(function InsightKpis({ view }: InsightKpisProps) {
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
          sub={<span className="whitespace-normal">{tile.sub}</span>}
          tone={tile.tone}
          help={tile.help}
        />
      ))}
    </>
  );
});
