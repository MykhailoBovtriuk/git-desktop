import { forwardRef } from 'react';
import type { HTMLAttributes, CSSProperties } from 'react';
import { cn } from './cn';

interface DragRegionProps extends HTMLAttributes<HTMLDivElement> {
  draggable?: boolean;
}

export const DragRegion = forwardRef<HTMLDivElement, DragRegionProps>(
  ({ draggable = true, style, className, children, ...rest }, ref) => {
    const drag: CSSProperties = { WebkitAppRegion: draggable ? 'drag' : 'no-drag' } as CSSProperties;
    return (
      <div ref={ref} {...rest} className={cn(className)} style={{ ...drag, ...style }}>
        {children}
      </div>
    );
  }
);

DragRegion.displayName = 'DragRegion';
