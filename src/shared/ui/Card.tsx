import type { HTMLAttributes } from 'react';
import { cn } from './cn';

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={cn('bg-mantle rounded p-3 flex items-center justify-between gap-4', className)}
    />
  );
}
