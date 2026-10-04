export type SelectSize = 'md' | 'sm';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  ariaLabel: string;
  placeholder?: string;
  size?: SelectSize;
  disabled?: boolean;
  id?: string;
  className?: string;
}
