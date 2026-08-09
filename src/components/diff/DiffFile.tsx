import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { DiffLine, FileDiff } from '../../types';

interface DiffFileProps {
  diff: FileDiff;
  // Index of this file's first hunk among all hunks in the diff, so a per-hunk
  // action can address the right hunk in the raw patch.
  baseHunkIndex: number;
  showHunkActions: boolean;
  isStaged: boolean;
  onHunk: (globalHunkIndex: number) => void;
  renderContent: (line: DiffLine) => ReactNode;
}

export function DiffFile({
  diff,
  baseHunkIndex,
  showHunkActions,
  isStaged,
  onHunk,
  renderContent,
}: DiffFileProps) {
  const { t } = useTranslation('diff');
  return (
    <div className="flex flex-col overflow-auto">
      <div className="flex items-center gap-2 px-3 py-2 bg-mantle border-b border-surface0 shrink-0">
        <span className="text-text text-sm font-medium">{diff.path.split('/').pop()}</span>
        <span className="text-green text-xs">+{diff.additions}</span>
        <span className="text-red text-xs">-{diff.deletions}</span>
      </div>

      <div className="font-mono text-xs overflow-auto flex-1">
        {diff.hunks.map((hunk, hi) => (
          <div key={hi}>
            <div className="flex items-center justify-between bg-surface0 text-subtext px-3 py-0.5 border-y border-surface1">
              <span>
                @@ -{hunk.oldStart},{hunk.oldCount} +{hunk.newStart},{hunk.newCount} @@
              </span>
              {showHunkActions && (
                <button
                  type="button"
                  onClick={() => onHunk(baseHunkIndex + hi)}
                  className="text-blue hover:text-sky text-xs px-1 shrink-0"
                >
                  {isStaged ? t('unstageHunk') : t('stageHunk')}
                </button>
              )}
            </div>
            {hunk.lines.map((line, li) => (
              <div
                key={li}
                className={`flex ${
                  line.type === 'add' ? 'bg-green/10' : line.type === 'remove' ? 'bg-red/10' : ''
                }`}
              >
                <span className="text-subtext w-8 shrink-0 text-right pr-2 select-none border-r border-surface0">
                  {line.oldLineNumber ?? ''}
                </span>
                <span className="text-subtext w-8 shrink-0 text-right pr-2 select-none border-r border-surface0">
                  {line.newLineNumber ?? ''}
                </span>
                <span className="px-2 whitespace-pre">
                  <span
                    className={
                      line.type === 'add'
                        ? 'text-green'
                        : line.type === 'remove'
                          ? 'text-red'
                          : 'text-subtext'
                    }
                  >
                    {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
                  </span>
                  {renderContent(line)}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
