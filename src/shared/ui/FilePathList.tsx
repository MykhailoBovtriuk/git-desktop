import type { ReactNode } from 'react';
import { basenameFromPath } from '../../lib/basename';
import { TruncatedText } from './TruncatedText';

export interface FilePathListProps {
  files: { path: string }[];
  selected: string | null;
  onSelect: (path: string) => void;
  /** In px; defaults to w-48. */
  width?: number;
  children?: ReactNode;
}

/** The narrow file sidebar of a commit or stash detail view. */
export function FilePathList({ files, selected, onSelect, width, children }: FilePathListProps) {
  return (
    <div
      className={`border-r border-surface0 overflow-y-auto shrink-0 ${width === undefined ? 'w-48' : ''}`}
      style={width === undefined ? undefined : { width }}
    >
      {children}
      {files.map(f => (
        <button
          key={f.path}
          onClick={() => onSelect(f.path)}
          className={`w-full text-left px-3 py-1.5 text-xs border-l-2 transition-colors ${
            selected === f.path
              ? 'bg-surface1 border-blue text-text'
              : 'border-transparent hover:bg-surface0 text-subtext'
          }`}
        >
          <TruncatedText className="block" tooltip={f.path} alwaysTooltip>
            {basenameFromPath(f.path)}
          </TruncatedText>
        </button>
      ))}
    </div>
  );
}
