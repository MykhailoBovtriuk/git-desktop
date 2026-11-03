import type { HTMLAttributes } from 'react';
import { cn } from './cn';

type Variant = 'ref' | 'beta' | 'count' | 'tag' | 'problem';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

const VARIANT: Record<Variant, string> = {
  ref: 'bg-surface0 text-blue text-xs px-1 rounded',
  beta: 'text-xs font-semibold uppercase tracking-wider bg-peach/20 text-peach px-1.5 py-0.5 rounded',
  count: 'text-xs px-1.5 py-0.5 rounded-full min-w-4.5 text-center bg-surface0 text-subtext',
  tag: 'shrink-0 px-1 rounded bg-surface0 text-subtext text-[10px] uppercase tracking-wide',
  problem: 'shrink-0 px-1 rounded bg-red/15 text-red text-[10px]',
};

export function Badge({ variant = 'ref', className, ...rest }: BadgeProps) {
  return <span {...rest} className={cn(VARIANT[variant], className)} />;
}
