import type { InputHTMLAttributes } from 'react';

export type InputSize = 'md' | 'sm';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: InputSize;
  invalid?: boolean;
}
