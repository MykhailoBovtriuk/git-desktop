import type { HTMLAttributes, KeyboardEvent, MouseEvent } from 'react';
import { cn } from './cn';

export interface ListItemProps extends HTMLAttributes<HTMLDivElement> {
  selected?: boolean;
}

export function ListItem({ selected, className, children, onClick, ...rest }: ListItemProps) {
  // A clickable row must also be a focusable one: without role/tabIndex it is
  // invisible to the keyboard and to screen readers, and this component backs
  // every list in the app.
  const interactive = onClick
    ? {
        onClick,
        role: 'button' as const,
        tabIndex: 0,
        onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick(e as unknown as MouseEvent<HTMLDivElement>);
          }
        },
      }
    : {};
  return (
    <div
      {...rest}
      {...interactive}
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
