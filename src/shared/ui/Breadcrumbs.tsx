import { Fragment } from 'react';
import { cn } from './cn';

export interface Crumb {
  label: string;
  /** Omitted on the last crumb: it is the page you are already on. */
  onClick?: () => void;
}

export interface BreadcrumbsProps {
  crumbs: Crumb[];
  className?: string;
}

export function Breadcrumbs({ crumbs, className }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center gap-1.5 text-sm', className)}>
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <Fragment key={`${crumb.label}-${i}`}>
            {i > 0 && (
              <span aria-hidden="true" className="text-surface2">
                /
              </span>
            )}
            {isLast || !crumb.onClick ? (
              <span aria-current={isLast ? 'page' : undefined} className="text-text font-semibold">
                {crumb.label}
              </span>
            ) : (
              <button onClick={crumb.onClick} className="text-blue hover:underline">
                {crumb.label}
              </button>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
