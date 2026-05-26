interface AccordionProps {
  title: string;
  badge?: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export function Accordion({ title, badge, open, onToggle, children }: AccordionProps) {
  return (
    <div className="flex flex-col">
      <button
        onClick={onToggle}
        className={`
          flex items-center justify-between w-full px-3 py-2 text-left
          border-l-2 transition-colors
          ${open
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
            <span className={`text-xs px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${
              open ? 'bg-surface1 text-text' : 'bg-surface0 text-subtext'
            }`}>
              {badge}
            </span>
          )}
        </div>
        <span className="text-xs opacity-50">{open ? '▼' : '▶'}</span>
      </button>

      {open && (
        <>
          <div className="bg-base">{children}</div>
        </>
      )}
    </div>
  );
}
