import type { FileStatus } from '../../types';
import { IconButton, ListItem } from '../../shared/ui';

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
  R: 'text-blue', C: 'text-peach', U: 'text-red', N: 'text-sky',
};

export function FileList({ files, staged, onStage, onUnstage, onDiscard, onSelect, selectedFile }: FileListProps) {
  if (files.length === 0) return null;

  return (
    <div className="flex flex-col">
      {files.map(file => {
        const name = file.path.split('/').pop() ?? file.path;
        const isSelected = selectedFile === file.path;

        return (
          <ListItem
            key={file.path}
            selected={isSelected}
            onClick={() => onSelect(file.path)}
            className="group flex items-center justify-between px-3 py-1 text-xs"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={`font-mono font-bold ${STATUS_COLOR[file.status] ?? 'text-text'}`}>
                {file.status}
              </span>
              <span className="text-text truncate">{name}</span>
            </div>

            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              {!staged && onStage && (
                <IconButton
                  tint="green"
                  title="Stage"
                  onClick={e => { e.stopPropagation(); onStage(file.path); }}
                >+</IconButton>
              )}
              {!staged && onDiscard && (
                <IconButton
                  tint="red"
                  title="Discard"
                  onClick={e => { e.stopPropagation(); onDiscard(file.path); }}
                >×</IconButton>
              )}
              {staged && onUnstage && (
                <IconButton
                  tint="yellow"
                  title="Unstage"
                  onClick={e => { e.stopPropagation(); onUnstage(file.path); }}
                >−</IconButton>
              )}
            </div>
          </ListItem>
        );
      })}
    </div>
  );
}
