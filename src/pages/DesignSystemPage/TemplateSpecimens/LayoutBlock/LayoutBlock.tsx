import { Card } from '@/components/design-system/atoms/Card/Card';
import type { LayoutBlockProps } from './types';

export function LayoutBlock({ children }: LayoutBlockProps) {
  return (
    <Card as="div" padding="sm">
      <span className="block truncate font-mono text-mono text-fg-muted">{children}</span>
    </Card>
  );
}
