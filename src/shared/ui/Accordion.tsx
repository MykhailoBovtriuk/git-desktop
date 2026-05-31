import { Badge } from './Badge';

interface AccordionProps {
  title: string;
  badge?: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  action?: React.ReactNode;
  indicateOpen?: boolean;
}

export function Accordion({ title, badge, open, onToggle, children, action, indicateOpen }: AccordionProps) {
  const showOpen = indicateOpen !== undefined ? indicateOpen : open;
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <button
        onClick={onToggle}
        className={`
          flex items-center justify-between w-full px-3 py-2 text-left
          border-l-2 transition-colors
          ${showOpen
            ? 'bg-surface0 border-blue text-text'
            : 'border-transparent hover:bg-surface0 text-subtext hover:text-text'
          }
        `}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide">
            {title}
          </span>
          {badge !== undefined && badge > 0 && (
            <Badge
              variant="count"
              className={open ? 'bg-surface1 text-text' : ''}
            >
              {badge}
            </Badge>
          )}
          {action && (
            <div onClick={e => e.stopPropagation()} className="flex items-center ml-2">
              {action}
            </div>
          )}
        </div>
        <span className="text-xs opacity-50">{showOpen ? '▼' : '▶'}</span>
      </button>

      {open && (
        <div className="bg-base flex-1 overflow-hidden">{children}</div>
      )}
    </div>
  );
}
