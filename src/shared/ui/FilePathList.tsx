import type { ReactNode } from 'react';
import { basenameFromPath } from '../../lib/basename';
import { TruncatedText } from './TruncatedText';

export interface FilePathListProps {
  files: { path: string }[];
  selected: string | null;
  onSelect: (path: string) => void;
  width: number;
  children?: ReactNode;
}

export function FilePathList({ files, selected, onSelect, width, children }: FilePathListProps) {
  return (
    <div className="border-r border-surface0 overflow-y-auto shrink-0" style={{ width }}>
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
