import type { ComponentPropsWithRef } from 'react';
import type { IconType } from 'react-icons';
import { cn } from './cn';

type Tint = 'green' | 'red' | 'yellow' | 'blue' | 'git' | 'subtext';
type Size = 'sm' | 'md';

export interface IconButtonProps extends Omit<ComponentPropsWithRef<'button'>, 'children'> {
  icon: IconType;
  tint?: Tint;
  size?: Size;
  spinning?: boolean;
  active?: boolean;
}

const TINT: Record<Tint, string> = {
  green: 'text-green',
  red: 'text-red',
  yellow: 'text-yellow',
  blue: 'text-blue',
  git: 'text-git',
  subtext: 'text-subtext hover:text-text',
};

const PAD: Record<Size, string> = { sm: 'p-0.5', md: 'p-1' };
const ICON_PX: Record<Size, number> = { sm: 14, md: 16 };

export function IconButton({
  icon: Icon,
  tint = 'subtext',
  size = 'md',
  spinning,
  active,
  className,
  ...rest
}: IconButtonProps) {
  return (
    <button
      aria-pressed={active}
      {...rest}
      className={cn(
        'inline-flex items-center justify-center rounded transition-colors hover:bg-surface1 disabled:opacity-40',
        TINT[active ? 'blue' : tint],
        PAD[size],
        className,
      )}
    >
      <Icon size={ICON_PX[size]} aria-hidden="true" className={spinning ? 'animate-spin' : ''} />
    </button>
  );
}
