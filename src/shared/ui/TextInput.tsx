import type { InputHTMLAttributes } from 'react';
import { cn } from './cn';

type Variant = 'search' | 'filter' | 'modal';

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  variant?: Variant;
}

const BASE = 'text-text rounded outline-none placeholder:text-subtext';

const VARIANT: Record<Variant, string> = {
  search: 'bg-mantle text-sm px-2 py-1',
  filter: 'bg-surface0 text-xs px-2 py-1',
  modal:  'bg-mantle text-sm px-3 py-2 border border-surface1 focus:border-blue',
};

export function TextInput({ variant = 'search', className, ...rest }: TextInputProps) {
  return <input {...rest} className={cn(BASE, VARIANT[variant], className)} />;
}
