import type { HTMLAttributes } from 'react';

export type CardElement = 'section' | 'div' | 'article';

export type CardPadding = 'none' | 'sm' | 'md';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  as?: CardElement;
  padding?: CardPadding;
}
