import type { FormFieldControlProps } from './types';

export function fieldErrorId(htmlFor: string): string {
  return `${htmlFor}-error`;
}

export function fieldHelperId(htmlFor: string): string {
  return `${htmlFor}-helper`;
}

function joinIds(...ids: (string | undefined)[]): string | undefined {
  const joined = ids.filter(Boolean).join(' ');
  return joined.length > 0 ? joined : undefined;
}

export function controlProps(
  existing: FormFieldControlProps,
  htmlFor: string,
  messageId: string | undefined,
  hasError: boolean,
  required: boolean,
): FormFieldControlProps {
  const injected: FormFieldControlProps = {};
  const describedBy = joinIds(existing['aria-describedby'], messageId);
  if (existing.id === undefined) injected.id = htmlFor;
  if (describedBy !== undefined) injected['aria-describedby'] = describedBy;
  if (hasError && existing['aria-invalid'] === undefined) injected['aria-invalid'] = true;
  if (required && existing.required === undefined) injected.required = true;
  return injected;
}
