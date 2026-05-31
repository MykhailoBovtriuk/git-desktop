import type { HTMLAttributes } from 'react';
import { cn } from './cn';

export interface ListItemProps extends HTMLAttributes<HTMLDivElement> {
  selected?: boolean;
}

export function ListItem({ selected, className, children, ...rest }: ListItemProps) {
  return (
    <div
      {...rest}
      className={cn(
        'cursor-pointer border-l-2 transition-colors',
        selected ? 'bg-surface1 border-blue' : 'border-transparent hover:bg-surface0',
        className,
      )}
    >
      {children}
    </div>
  );
}
