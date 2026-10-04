import { useRef, type KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';
import { tabVariants } from './Tabs.variants';
import type { TabsProps } from './types';
import { tabElementId, tabPanelId, targetTabIndex } from './utils';

export function Tabs<T extends string = string>({ items, value, onChange, ariaLabel, id, className }: TabsProps<T>) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndex = items.findIndex((item) => item.value === value);
  const focusableIndex = selectedIndex === -1 ? 0 : selectedIndex;

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const target = targetTabIndex(event.key, index, items.length);
    if (target === null) return;
    event.preventDefault();
    tabRefs.current[target]?.focus();
    if (items[target].value !== value) onChange(items[target].value);
  };

  return (
    <div role="tablist" aria-label={ariaLabel} className={cn('flex min-w-0 gap-5 border-b border-line', className)}>
      {items.map((item, index) => {
        const selected = index === selectedIndex;
        return (
          <button
            key={item.value}
            ref={(node) => {
              tabRefs.current[index] = node;
            }}
            type="button"
            role="tab"
            id={tabElementId(id, item.value)}
            aria-selected={selected}
            aria-controls={tabPanelId(id, item.value)}
            tabIndex={index === focusableIndex ? 0 : -1}
            className={tabVariants({ selected })}
            onClick={selected ? undefined : () => onChange(item.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {item.label}
            {item.count !== undefined ? <span className="font-mono text-mono text-fg-subtle">{item.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
