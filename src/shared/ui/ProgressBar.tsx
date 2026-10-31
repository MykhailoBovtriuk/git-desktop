import { cn } from './cn';

export function ProgressBar({
  percent,
  className,
}: {
  percent: number | null;
  className?: string;
}) {
  return (
    <div className={cn('h-1.5 bg-surface2 rounded overflow-hidden', className)}>
      <div
        className={cn('h-full bg-blue rounded', percent === null && 'w-full animate-pulse')}
        style={percent === null ? undefined : { width: `${percent}%` }}
      />
    </div>
  );
}
