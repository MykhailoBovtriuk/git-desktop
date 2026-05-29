import type { HTMLAttributes } from 'react';
import { cn } from './cn';

export function SectionLabel({ className, ...rest }: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      {...rest}
      className={cn('text-subtext text-xs uppercase tracking-wide px-2 py-1', className)}
    />
  );
}
