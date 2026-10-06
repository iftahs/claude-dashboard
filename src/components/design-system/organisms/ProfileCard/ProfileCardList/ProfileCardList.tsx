import { GroupLabel } from '@/components/design-system/atoms/GroupLabel/GroupLabel';
import type { ProfileCardListProps } from './types';
import { MAX_VISIBLE_ITEMS } from './utils';

export function ProfileCardList({ list }: ProfileCardListProps) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <GroupLabel as="span" note={String(list.count)}>
        {list.title}
      </GroupLabel>
      {list.items.length > 0 ? (
        <ul
          aria-label={list.title}
          tabIndex={list.items.length > MAX_VISIBLE_ITEMS ? 0 : undefined}
          className="max-h-48 divide-y divide-line overflow-y-auto rounded-control border border-line bg-surface-sunken focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {list.items.map((entry, index) => (
            <li key={`${index}:${entry}`} title={entry} className="truncate px-3 py-1.5 font-mono text-mono text-fg-muted">
              {entry}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-control border border-line bg-surface-sunken px-3 py-2 text-small text-fg-muted">{list.empty}</p>
      )}
    </div>
  );
}
