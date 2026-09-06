import type { ButtonHTMLAttributes } from 'react';
import type { IconType } from 'react-icons';
import { cn } from './cn';

type Tint = 'green' | 'red' | 'yellow' | 'blue' | 'subtext';
type Size = 'sm' | 'md';

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  /** Pick one from shared/ui/icons — not straight from react-icons. */
  icon: IconType;
  tint?: Tint;
  size?: Size;
  /** Spins the icon only, so the button surface keeps its hover/press feedback. */
  spinning?: boolean;
}

const TINT: Record<Tint, string> = {
  green: 'text-green',
  red: 'text-red',
  yellow: 'text-yellow',
  blue: 'text-blue',
  subtext: 'text-subtext hover:text-text',
};

// md for chrome (titlebar, footer), sm for the dense file and stash rows.
const PAD: Record<Size, string> = { sm: 'p-0.5', md: 'p-1' };
const ICON_PX: Record<Size, number> = { sm: 14, md: 16 };

export function IconButton({
  icon: Icon,
  tint = 'subtext',
  size = 'md',
  spinning,
  className,
  ...rest
}: IconButtonProps) {
  return (
    <button
      {...rest}
      className={cn(
        'inline-flex items-center justify-center rounded transition-colors hover:bg-surface1 disabled:opacity-40',
        TINT[tint],
        PAD[size],
        className,
      )}
    >
      <Icon size={ICON_PX[size]} aria-hidden="true" className={spinning ? 'animate-spin' : ''} />
    </button>
  );
}
