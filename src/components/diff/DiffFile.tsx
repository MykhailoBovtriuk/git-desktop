import { useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { DiffHunk, DiffLine, FileDiff } from '../../types';
import { basenameFromPath } from '../../lib/basename';

interface DiffFileProps {
  diff: FileDiff;
  baseHunkIndex: number;
  showHunkActions: boolean;
  isStaged: boolean;
  onHunk: (globalHunkIndex: number) => void;
  renderContent: (line: DiffLine) => ReactNode;
}

type Row =
  | { kind: 'hunk'; hunkIndex: number; hunk: DiffHunk }
  | { kind: 'line'; line: DiffLine };

export function DiffFile({
  diff,
  baseHunkIndex,
  showHunkActions,
  isStaged,
  onHunk,
  renderContent,
}: DiffFileProps) {
  const { t } = useTranslation('diff');

  // Flat row list so one virtualizer covers headers and lines alike. Without
  // it a 3000-line file rendered ~180k DOM nodes and took 1.7s to appear.
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    diff.hunks.forEach((hunk, hunkIndex) => {
      out.push({ kind: 'hunk', hunkIndex, hunk });
      for (const line of hunk.lines) out.push({ kind: 'line', line });
    });
    return out;
  }, [diff]);

  // Absolutely positioned rows cannot stretch the scroll area, so the sizing
  // div needs an explicit width in ch or the horizontal scrollbar jitters.
  const maxCols = useMemo(
    () =>
      diff.hunks.reduce(
        (max, hunk) => hunk.lines.reduce((m, l) => Math.max(m, l.content.length), max),
        0,
      ),
    [diff],
  );

  const parentRef = useRef<HTMLDivElement>(null);
  // Mutable instance by design; the lint rule cannot prove it stable.
  // eslint-disable-next-line react-hooks/incompatible-library
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: i => (rows[i].kind === 'hunk' ? 26 : 16),
    overscan: 20,
  });

  return (
    <div className="flex flex-col overflow-hidden flex-1">
      <div className="flex items-center gap-2 px-3 py-2 bg-mantle border-b border-surface0 shrink-0">
        <span className="text-text text-sm font-medium" title={diff.path}>
          {basenameFromPath(diff.path)}
        </span>
        <span className="text-green text-xs">+{diff.additions}</span>
        <span className="text-red text-xs">-{diff.deletions}</span>
      </div>

      <div ref={parentRef} className="font-mono text-xs overflow-auto flex-1">
        <div
          className="relative"
          style={{
            height: rowVirtualizer.getTotalSize(),
            // 5rem ≈ two 2rem gutters + px-2 + the +/- sign column.
            minWidth: `max(100%, calc(${maxCols}ch + 5rem))`,
          }}
        >
          {rowVirtualizer.getVirtualItems().map(virtualRow => {
            const row = rows[virtualRow.index];
            return (
              <div
                key={virtualRow.index}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {row.kind === 'hunk' ? (
                  <div className="flex items-center justify-between bg-surface0 text-subtext px-3 py-0.5 border-y border-surface1">
                    <span>
                      @@ -{row.hunk.oldStart},{row.hunk.oldCount} +{row.hunk.newStart},
                      {row.hunk.newCount} @@
                    </span>
                    {showHunkActions && (
                      <button
                        type="button"
                        onClick={() => onHunk(baseHunkIndex + row.hunkIndex)}
                        className="text-blue hover:text-sky text-xs px-1 shrink-0"
                      >
                        {isStaged ? t('unstageHunk') : t('stageHunk')}
                      </button>
                    )}
                  </div>
                ) : (
                  <div
                    className={`flex ${
                      row.line.type === 'add'
                        ? 'bg-green/10'
                        : row.line.type === 'remove'
                          ? 'bg-red/10'
                          : ''
                    }`}
                  >
                    <span className="text-subtext w-8 shrink-0 text-right pr-2 select-none border-r border-surface0">
                      {row.line.oldLineNumber ?? ''}
                    </span>
                    <span className="text-subtext w-8 shrink-0 text-right pr-2 select-none border-r border-surface0">
                      {row.line.newLineNumber ?? ''}
                    </span>
                    <span className="px-2 whitespace-pre">
                      <span
                        className={
                          row.line.type === 'add'
                            ? 'text-green'
                            : row.line.type === 'remove'
                              ? 'text-red'
                              : 'text-subtext'
                        }
                      >
                        {row.line.type === 'add' ? '+' : row.line.type === 'remove' ? '-' : ' '}
                      </span>
                      {renderContent(row.line)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
