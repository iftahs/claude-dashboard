import { cloneElement } from 'react';
import { cn } from '@/lib/cn';
import type { FormFieldProps } from './types';
import { controlProps, fieldErrorId, fieldHelperId } from './utils';

export function FormField({ label, htmlFor, children, helper, error, required = false, className }: FormFieldProps) {
  const hasError = Boolean(error);
  const hasHelper = !hasError && Boolean(helper);
  const messageId = hasError ? fieldErrorId(htmlFor) : hasHelper ? fieldHelperId(htmlFor) : undefined;

  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-small font-medium text-fg">
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-0.5 text-danger-fg">
            *
          </span>
        ) : null}
      </label>
      {cloneElement(children, controlProps(children.props, htmlFor, messageId, hasError, required))}
      {hasError ? (
        <span id={messageId} className="text-caption text-danger-fg">
          {error}
        </span>
      ) : null}
      {hasHelper ? (
        <span id={messageId} className="text-caption text-fg-subtle">
          {helper}
        </span>
      ) : null}
    </div>
  );
}
