import type { ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'danger' | 'surface' | 'neutral';
type Size = 'sm' | 'md';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
}

const BASE = 'rounded transition-opacity transition-colors disabled:opacity-40';

const VARIANT: Record<Variant, string> = {
  primary:   'bg-blue text-mantle hover:opacity-90',
  secondary: 'text-subtext hover:text-text',
  danger:    'bg-red/20 text-red hover:bg-red/30',
  surface:   'bg-surface0 text-text hover:bg-surface1',
  neutral:   'bg-surface1 text-text hover:bg-surface2',
};

const SIZE: Record<Size, string> = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
};

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      className={cn(BASE, VARIANT[variant], SIZE[size], fullWidth && 'w-full', className)}
    />
  );
}
