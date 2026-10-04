export interface ResizeHandleProps {
  label: string;
  onMouseDown: (e: React.MouseEvent) => void;
}

/** Vertical drag handle between two columns. Its own column, not an overlay:
    at right-0 it covered the neighbouring list's scrollbar. */
export function ResizeHandle({ label, onMouseDown }: ResizeHandleProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      onMouseDown={onMouseDown}
      className="w-1.5 shrink-0 cursor-col-resize hover:bg-blue/40 active:bg-blue/60 transition-colors"
    />
  );
}
