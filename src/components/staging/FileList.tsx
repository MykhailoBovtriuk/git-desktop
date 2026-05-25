import type { FileStatus } from '../../types';

interface FileListProps {
  files: FileStatus[];
  staged: boolean;
  onStage?: (path: string) => void;
  onUnstage?: (path: string) => void;
  onDiscard?: (path: string) => void;
  onSelect: (path: string) => void;
  selectedFile: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  A: 'text-green', M: 'text-yellow', D: 'text-red',
  R: 'text-blue', C: 'text-peach', U: 'text-red', '?': 'text-subtext',
};

export function FileList({ files, staged, onStage, onUnstage, onDiscard, onSelect, selectedFile }: FileListProps) {
  if (files.length === 0) return null;

  return (
    <div className="flex flex-col">
      {files.map(file => {
        const name = file.path.split('/').pop() ?? file.path;
        const isSelected = selectedFile === file.path;

        return (
          <div
            key={file.path}
            onClick={() => onSelect(file.path)}
            className={`group flex items-center justify-between px-3 py-1 cursor-pointer text-xs border-l-2 transition-colors ${
              isSelected
                ? 'bg-surface1 border-blue'
                : 'border-transparent hover:bg-surface0'
            }`}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={`font-mono font-bold ${STATUS_COLOR[file.status] ?? 'text-text'}`}>
                {file.status}
              </span>
              <span className="text-text truncate">{name}</span>
            </div>

            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              {!staged && onStage && (
                <button
                  onClick={e => { e.stopPropagation(); onStage(file.path); }}
                  className="text-green hover:bg-surface1 rounded px-1 py-0.5"
                  title="Stage"
                >
                  +
                </button>
              )}
              {!staged && onDiscard && (
                <button
                  onClick={e => { e.stopPropagation(); onDiscard(file.path); }}
                  className="text-red hover:bg-surface1 rounded px-1 py-0.5"
                  title="Discard"
                >
                  ×
                </button>
              )}
              {staged && onUnstage && (
                <button
                  onClick={e => { e.stopPropagation(); onUnstage(file.path); }}
                  className="text-yellow hover:bg-surface1 rounded px-1 py-0.5"
                  title="Unstage"
                >
                  −
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
