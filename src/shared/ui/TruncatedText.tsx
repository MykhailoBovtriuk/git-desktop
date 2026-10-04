import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { cn } from './cn';
import { Tooltip } from './Tooltip';

const DELAY_MS = 400;

export interface TruncatedTextProps {
  children: string;
  as?: 'span' | 'p' | 'div';
  className?: string;
  /** Full text when the shown one is a short form of it (a basename, say). */
  tooltip?: string;
  /** Show `tooltip` even without an ellipsis, as long as it differs from the shown text. */
  alwaysTooltip?: boolean;
}

/** Single-line text with an ellipsis; hovering shows the full text only when it was cut. */
export function TruncatedText({
  children,
  as: Tag = 'span',
  className,
  tooltip,
  alwaysTooltip,
}: TruncatedTextProps) {
  const ref = useRef<HTMLElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [open, setOpen] = useState(false);
  const id = useId();
  const full = tooltip ?? children;

  const hide = useCallback(() => {
    clearTimeout(timer.current);
    setOpen(false);
  }, []);

  const show = () => {
    const el = ref.current;
    if (!el) return;
    const cut = el.scrollWidth > el.clientWidth;
    if (!cut && !(alwaysTooltip && full !== children)) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(true), DELAY_MS);
  };

  useEffect(() => {
    if (!open) return;
    window.addEventListener('wheel', hide, { passive: true });
    window.addEventListener('scroll', hide, true);
    return () => {
      window.removeEventListener('wheel', hide);
      window.removeEventListener('scroll', hide, true);
    };
  }, [open, hide]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <>
      <Tag
        ref={ref as never}
        className={cn('truncate', className)}
        aria-describedby={open ? id : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onMouseDown={hide}
      >
        {children}
      </Tag>
      <Tooltip open={open} anchorRef={ref} id={id}>
        {full}
      </Tooltip>
    </>
  );
}
