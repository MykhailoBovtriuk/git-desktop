import type { HTMLAttributes } from 'react';
import { cn } from './cn';

type Variant = 'ref' | 'beta' | 'count';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: Variant;
}

const VARIANT: Record<Variant, string> = {
  ref:   'bg-surface0 text-blue text-xs px-1 rounded',
  beta:  'text-xs font-semibold uppercase tracking-wider bg-peach/20 text-peach px-1.5 py-0.5 rounded',
  count: 'text-xs px-1.5 py-0.5 rounded-full min-w-[18px] text-center bg-surface0 text-subtext',
};

export function Badge({ variant = 'ref', className, ...rest }: BadgeProps) {
  return <span {...rest} className={cn(VARIANT[variant], className)} />;
}
