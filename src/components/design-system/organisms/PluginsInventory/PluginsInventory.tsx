import { Section } from '@/components/design-system/organisms/Section/Section';
import { InventoryChip } from './InventoryChip/InventoryChip';
import { InventoryGroup } from './InventoryGroup/InventoryGroup';
import type { PluginsInventoryProps } from './types';

export function PluginsInventory({ view, className }: PluginsInventoryProps) {
  return (
    <Section
      as="h3"
      title={view.title}
      description={view.description}
      help={view.help}
      state={view.state}
      ai={view.ai}
      className={className}
    >
      <div className="flex flex-col gap-5">
        {view.defaults.length > 0 ? (
          <div className="flex min-w-0 flex-wrap gap-1.5">
            {view.defaults.map((item) => (
              <InventoryChip key={item.key} item={item} />
            ))}
          </div>
        ) : null}
        <div className="-mb-5 gap-x-8 lg:columns-2">
          {view.groups.map((group) => (
            <div key={group.key} className="break-inside-avoid pb-5">
              <InventoryGroup group={group} />
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
