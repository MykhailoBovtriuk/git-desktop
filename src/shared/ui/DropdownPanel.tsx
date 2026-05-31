import type { HTMLAttributes } from 'react';
import { cn } from './cn';

type Align = 'center' | 'right';

export interface DropdownPanelProps extends HTMLAttributes<HTMLDivElement> {
  align?: Align;
  width?: string;
}

const ALIGN: Record<Align, string> = {
  center: 'left-1/2 -translate-x-1/2',
  right:  'right-0',
};

export function DropdownPanel({
  align = 'center',
  width = 'w-64',
  className,
  children,
  ...rest
}: DropdownPanelProps) {
  return (
    <div
      {...rest}
      className={cn(
        'absolute top-full mt-1 bg-surface0 rounded-lg shadow-xl z-50',
        ALIGN[align],
        width,
        className,
      )}
    >
      {children}
    </div>
  );
}
