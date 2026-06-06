import { Badge } from './Badge';

interface AccordionProps {
  title: string;
  badge?: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export function Accordion({ title, badge, open, onToggle, children }: AccordionProps) {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div
        className={`
          relative flex items-center justify-between w-full px-3 py-2
          border-l-2 transition-colors
          ${open
            ? 'bg-surface0 border-blue text-text'
            : 'border-transparent hover:bg-surface0 text-subtext hover:text-text'
          }
        `}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={title}
          className="absolute inset-0 w-full cursor-pointer"
        />
        <div className="relative flex items-center gap-2 pointer-events-none">
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
        <span className="text-xs opacity-50">{showOpen ? '▼' : '▶'}</span>
        </div>
        <span className="text-xs opacity-50">{open ? '▼' : '▶'}</span>
      </button>

      {open && (
        <div className="bg-base flex-1 overflow-hidden">{children}</div>
      )}
    </div>
  );
}
