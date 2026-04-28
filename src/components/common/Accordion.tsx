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
        className="flex items-center justify-between w-full px-3 py-2 bg-mantle hover:bg-surface0 text-left transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-subtext">{title}</span>
          {badge !== undefined && badge > 0 && (
            <span className="bg-surface1 text-text text-xs px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
              {badge}
            </span>
          )}
        </div>
        <span className="text-subtext text-xs">{open ? '▼' : '▶'}</span>
      </button>
      {open && <div className="bg-base">{children}</div>}
    </div>
  );
}
