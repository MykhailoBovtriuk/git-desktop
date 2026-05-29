import type { ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

type Tint = 'green' | 'red' | 'yellow' | 'blue' | 'subtext';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tint?: Tint;
}

const TINT: Record<Tint, string> = {
  green:   'text-green',
  red:     'text-red',
  yellow:  'text-yellow',
  blue:    'text-blue',
  subtext: 'text-subtext hover:text-text',
};

export function IconButton({ tint = 'subtext', className, ...rest }: IconButtonProps) {
  return (
    <button
      {...rest}
      className={cn('rounded px-1 py-0.5 hover:bg-surface1', TINT[tint], className)}
    />
  );
}
