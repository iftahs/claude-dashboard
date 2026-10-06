import type { ButtonHTMLAttributes } from 'react';

export type IconButtonVariant = 'ghost' | 'secondary';

export type IconButtonSize = 'md' | 'sm';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  label: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
}
