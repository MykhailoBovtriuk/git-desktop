import type { ReactNode } from 'react';

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="h-full flex items-center justify-center text-subtext text-sm">{children}</div>
  );
}
