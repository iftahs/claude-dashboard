import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { cn } from '@/lib/cn';
import { tabVariants } from './Tabs.variants';
import type { TabMarker, TabsProps } from './types';
import { sameMarker, tabElementId, tabPanelId, targetTabIndex } from './utils';

export function Tabs<T extends string = string>({ items, value, onChange, ariaLabel, id, className }: TabsProps<T>) {
  const listRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [marker, setMarker] = useState<TabMarker | null>(null);
  const selectedIndex = items.findIndex((item) => item.value === value);
  const focusableIndex = selectedIndex === -1 ? 0 : selectedIndex;

  useLayoutEffect(() => {
    const measure = () => {
      const tab = tabRefs.current[selectedIndex];
      const next = tab && tab.offsetWidth > 0 ? { left: tab.offsetLeft, width: tab.offsetWidth } : null;
      setMarker((previous) => (sameMarker(previous, next) ? previous : next));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(measure);
    if (listRef.current) observer.observe(listRef.current);
    for (const tab of tabRefs.current) if (tab) observer.observe(tab);
    return () => observer.disconnect();
  }, [selectedIndex, items.length]);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const target = targetTabIndex(event.key, index, items.length);
    if (target === null) return;
    event.preventDefault();
    tabRefs.current[target]?.focus();
    if (items[target].value !== value) onChange(items[target].value);
  };

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={ariaLabel}
      className={cn('relative flex min-w-0 gap-5 border-b border-line', className)}
    >
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
            className={tabVariants({ selected, marked: selected && marker !== null })}
            onClick={selected ? undefined : () => onChange(item.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {item.label}
            {item.count !== undefined ? <span className="font-mono text-mono font-normal text-fg-subtle">{item.count}</span> : null}
          </button>
        );
      })}
      {marker ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-px left-0 h-0.5 bg-accent transition-[transform,width] duration-base ease-emphasized"
          style={{ width: marker.width, transform: `translateX(${marker.left}px)` }}
        />
      ) : null}
    </div>
  );
}
