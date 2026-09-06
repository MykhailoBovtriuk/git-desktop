import type { ReactNode } from 'react';
import { basenameFromPath } from '../../lib/basename';

export interface FilePathListProps {
  files: { path: string }[];
  selected: string | null;
  onSelect: (path: string) => void;
  children?: ReactNode;
}

/** The narrow file sidebar of a commit or stash detail view. */
export function FilePathList({ files, selected, onSelect, children }: FilePathListProps) {
  return (
    <div className="w-48 border-r border-surface0 overflow-y-auto shrink-0">
      {children}
      {files.map(f => (
        <button
          key={f.path}
          onClick={() => onSelect(f.path)}
          title={f.path}
          className={`w-full text-left px-3 py-1.5 text-xs border-l-2 transition-colors truncate ${
            selected === f.path
              ? 'bg-surface1 border-blue text-text'
              : 'border-transparent hover:bg-surface0 text-subtext'
          }`}
        >
          {basenameFromPath(f.path)}
        </button>
      ))}
    </div>
  );
}
