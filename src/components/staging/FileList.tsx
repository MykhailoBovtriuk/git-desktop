import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { FileStatus } from '../../types';
import {
  CheckIcon,
  CopyIcon,
  IconButton,
  ListItem,
  StageIcon,
  UnstageIcon,
  DiscardIcon,
} from '../../shared/ui';

interface FileListProps {
  files: FileStatus[];
  staged: boolean;
  onStage?: (path: string) => void;
  onUnstage?: (path: string) => void;
  onDiscard?: (path: string) => void;
  /** Hands the row's path to whoever knows the repository root. */
  onCopyPath?: (path: string) => void;
  onSelect: (path: string) => void;
  selectedFile: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  A: 'text-green',
  M: 'text-yellow',
  D: 'text-red',
  R: 'text-blue',
  C: 'text-peach',
  U: 'text-red',
  N: 'text-sky',
};

export function FileList({
  files,
  staged,
  onStage,
  onUnstage,
  onDiscard,
  onCopyPath,
  onSelect,
  selectedFile,
}: FileListProps) {
  const { t } = useTranslation('staging');
  // Copying moves nothing on screen, so without a mark the click looks like it
  // did nothing at all. A toast would be louder than everything around it:
  // staging says nothing on success either, it just shows the file elsewhere.
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const copy = (path: string) => {
    onCopyPath?.(path);
    setCopiedPath(path);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopiedPath(null), 1200);
  };

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
              <span
                className={`font-mono font-bold ${STATUS_COLOR[file.status] ?? 'text-text'}`}
                title={file.status === 'N' ? t('untrackedFile') : undefined}
              >
                {file.status}
              </span>
              <span className="text-text truncate">{name}</span>
            </div>

            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              {/* First in the row: it is the only action here that changes
                  nothing, and sitting next to Discard makes a slip expensive. */}
              {onCopyPath && (
                <IconButton
                  icon={copiedPath === file.path ? CheckIcon : CopyIcon}
                  size="sm"
                  tint={copiedPath === file.path ? 'green' : 'subtext'}
                  title={copiedPath === file.path ? t('copied') : t('copyPath')}
                  onClick={e => {
                    e.stopPropagation();
                    copy(file.path);
                  }}
                />
              )}
              {!staged && onStage && (
                <IconButton
                  icon={StageIcon}
                  size="sm"
                  tint="green"
                  title={t('stage')}
                  onClick={e => {
                    e.stopPropagation();
                    onStage(file.path);
                  }}
                />
              )}
              {!staged && onDiscard && (
                <IconButton
                  icon={DiscardIcon}
                  size="sm"
                  tint="red"
                  title={file.status === 'N' ? t('deleteUntrackedFile') : t('discard')}
                  onClick={e => {
                    e.stopPropagation();
                    onDiscard(file.path);
                  }}
                />
              )}
              {staged && onUnstage && (
                <IconButton
                  icon={UnstageIcon}
                  size="sm"
                  tint="yellow"
                  title={t('unstage')}
                  onClick={e => {
                    e.stopPropagation();
                    onUnstage(file.path);
                  }}
                />
              )}
            </div>
          </ListItem>
        );
      })}
    </div>
  );
}
