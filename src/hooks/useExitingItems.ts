import { useEffect, useRef, useState } from 'react';

export type Exiting<T> = T & { leaving: boolean };

// An item that leaves `items` stays in the result for `exitMs`, flagged `leaving`, so it can animate out.
export function useExitingItems<T extends { id: string }>(items: readonly T[], exitMs: number): Exiting<T>[] {
  const [kept, setKept] = useState<readonly T[]>(items);
  const keptRef = useRef(kept);
  keptRef.current = kept;
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const live = new Map(items.map((item) => [item.id, item]));
    for (const [id, timer] of timers.current) {
      if (!live.has(id)) continue;
      clearTimeout(timer);
      timers.current.delete(id);
    }
    for (const { id } of keptRef.current) {
      if (live.has(id) || timers.current.has(id)) continue;
      timers.current.set(
        id,
        setTimeout(() => {
          timers.current.delete(id);
          setKept((list) => list.filter((entry) => entry.id !== id));
        }, exitMs),
      );
    }
    setKept((previous) => {
      const known = new Set(previous.map((item) => item.id));
      const next = [...previous.map((item) => live.get(item.id) ?? item), ...items.filter((item) => !known.has(item.id))];
      return next.length === previous.length && next.every((item, index) => item === previous[index]) ? previous : next;
    });
  }, [items, exitMs]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  const live = new Map(items.map((item) => [item.id, item]));
  const known = new Set(kept.map((item) => item.id));
  return [
    ...kept.map((item) => ({ ...(live.get(item.id) ?? item), leaving: !live.has(item.id) })),
    ...items.filter((item) => !known.has(item.id)).map((item) => ({ ...item, leaving: false })),
  ];
}
