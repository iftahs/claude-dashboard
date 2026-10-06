import { Badge } from '@/components/design-system/atoms/Badge/Badge';
import { KeyValueRow } from '@/components/design-system/molecules/KeyValueRow/KeyValueRow';
import { Section } from '@/components/design-system/organisms/Section/Section';
import { cn } from '@/lib/cn';
import { ProfileCardList } from './ProfileCardList/ProfileCardList';
import type { ProfileCardProps } from './types';

export function ProfileCard({ view, compact = false, className }: ProfileCardProps) {
  const columns = cn('grid gap-x-8 gap-y-2', !compact && 'md:grid-cols-2');

  return (
    <Section as="h3" title={view.title} description={view.description} help={view.help} state={view.state} className={className}>
      <div className="flex flex-col gap-4">
        <div className={columns}>
          {view.facts.map((fact) => (
            <KeyValueRow
              key={fact.label}
              label={fact.label}
              help={fact.help ?? undefined}
              value={
                <span title={fact.title} className={cn('block max-w-56 truncate', fact.capitalize && 'capitalize')}>
                  {fact.value}
                </span>
              }
            />
          ))}
        </div>
        <div className={cn(columns, 'border-t border-line pt-4')}>
          {view.flags.map((flag) => (
            <KeyValueRow key={flag.label} label={flag.label} value={<Badge tone={flag.tone}>{flag.value}</Badge>} />
          ))}
        </div>
        <div className={cn('grid gap-4 border-t border-line pt-4', !compact && 'lg:grid-cols-2')}>
          {view.lists.map((list) => (
            <ProfileCardList key={list.title} list={list} />
          ))}
        </div>
      </div>
    </Section>
  );
}
