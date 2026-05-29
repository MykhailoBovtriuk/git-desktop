import type { TextareaHTMLAttributes } from 'react';
import { cn } from './cn';

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className, ...rest }: TextareaProps) {
  return (
    <textarea
      {...rest}
      className={cn(
        'w-full bg-surface0 text-text text-xs rounded p-2 resize-none outline-none',
        'placeholder:text-subtext border border-transparent focus:border-surface2',
        className,
      )}
    />
  );
}
