import { cn } from '@/lib/cn';
import { cardVariants } from './Card.variants';
import type { CardProps } from './types';

export function Card({ as: Tag = 'section', padding, className, ...props }: CardProps) {
  return <Tag className={cn(cardVariants({ padding }), className)} {...props} />;
}
