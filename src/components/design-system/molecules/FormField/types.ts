import type { ReactElement, ReactNode } from 'react';

export interface FormFieldControlProps {
  id?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false' | 'grammar' | 'spelling';
  required?: boolean;
}

export interface FormFieldProps {
  label: string;
  htmlFor: string;
  children: ReactElement<FormFieldControlProps>;
  helper?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  className?: string;
}
