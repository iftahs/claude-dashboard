import { Button } from '@/components/design-system/atoms/Button/Button';
import { Toast } from '@/components/design-system/molecules/Toast/Toast';
import { cn } from '@/lib/cn';
import type { ToastStackProps } from './types';

export function ToastStack({ items, onDismiss, label = 'Notifications' }: ToastStackProps) {
  if (items.length === 0) return null;

  return (
    <section
      aria-label={label}
      className="pointer-events-none fixed bottom-4 right-4 z-50 flex max-h-[calc(100dvh-32px)] max-w-[calc(100vw-32px)] flex-col items-end gap-2 overflow-y-auto"
    >
      {items.map((item) => (
        <Toast
          key={item.id}
          tone={item.tone}
          title={item.title}
          description={item.description}
          leaving={item.leaving}
          className={cn('flex-none', item.leaving ? 'pointer-events-none' : 'pointer-events-auto')}
          onDismiss={item.dismissible === false ? undefined : () => onDismiss(item.id)}
          action={
            item.action ? (
              <Button size="sm" onClick={item.action.onClick}>
                {item.action.label}
              </Button>
            ) : undefined
          }
        />
      ))}
    </section>
  );
}
