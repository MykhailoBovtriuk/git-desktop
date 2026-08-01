import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useUiStore } from '../../stores/ui-store';
import { useRepoStore } from '../../stores/repo-store';
import { gitApi } from '../../api/git-api';
import { parseDiff } from './parse-diff';
import type { FileDiff } from '../../types';

export function DiffViewer() {
  const { t } = useTranslation('diff');
  const { selectedFile, selectedFileArea, selectedCommit, activeView } = useUiStore(
    useShallow(s => ({
      selectedFile: s.selectedFile,
      selectedFileArea: s.selectedFileArea,
      selectedCommit: s.selectedCommit,
      activeView: s.activeView,
    })),
  );
  const stagedInStatus = useRepoStore(
    s => !!selectedFile && s.status.staged.some(f => f.path === selectedFile),
  );
  // The clicked list decides the diff source: a partially staged file is in
  // both lists, so the path alone is ambiguous. Fall back to the status
  // lookup only when a selection carries no area.
  const isStaged = selectedFileArea ? selectedFileArea === 'staged' : stagedInStatus;
  const inChanges = useRepoStore(
    s =>
      !!selectedFile &&
      (s.status.staged.some(f => f.path === selectedFile) ||
        s.status.unstaged.some(f => f.path === selectedFile)),
  );
  const useCommitContext = (activeView === 'history' || activeView === 'graph') && !!selectedCommit;
  // A selection is only valid while viewing a commit, or while the file is still
  // among the current changes. Otherwise (e.g. after commit/discard) show empty.
  const hasSelection = !!selectedFile && (useCommitContext || inChanges);
  const [diffs, setDiffs] = useState<FileDiff[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSelection) {
      setDiffs([]);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        let raw = '';
        if (useCommitContext && selectedCommit) {
          raw = await gitApi.getFileDiff(selectedCommit, selectedFile);
        } else {
          raw = isStaged
            ? await gitApi.getStagedDiff(selectedFile)
            : await gitApi.getWorkingDiff(selectedFile);
        }
        if (!cancelled) setDiffs(parseDiff(raw));
      } catch (err) {
        if (!cancelled) {
          setDiffs([]);
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedFile, selectedCommit, isStaged, useCommitContext, hasSelection]);

  if (!hasSelection) {
    return (
      <div className="h-full flex items-center justify-center text-subtext text-sm">
        {t('noDiff')}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-subtext text-sm">
        {t('common:loading')}
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-1 text-red text-sm px-4 text-center">
        <span>{t('loadFailed')}</span>
        <span className="text-subtext text-xs break-all">{error}</span>
      </div>
    );
  }

  if (diffs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-subtext text-sm">
        {t('noDiffToDisplay')}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {diffs.map(diff => (
        <div key={diff.path} className="flex flex-col overflow-auto">
          <div className="flex items-center gap-2 px-3 py-2 bg-mantle border-b border-surface0 shrink-0">
            <span className="text-text text-sm font-medium">{diff.path.split('/').pop()}</span>
            <span className="text-green text-xs">+{diff.additions}</span>
            <span className="text-red text-xs">-{diff.deletions}</span>
          </div>

          <div className="font-mono text-xs overflow-auto flex-1">
            {diff.hunks.map((hunk, hi) => (
              <div key={hi}>
                <div className="bg-surface0 text-subtext px-3 py-0.5 border-y border-surface1">
                  @@ -{hunk.oldStart},{hunk.oldCount} +{hunk.newStart},{hunk.newCount} @@
                </div>
                {hunk.lines.map((line, li) => (
                  <div
                    key={li}
                    className={`flex ${
                      line.type === 'add'
                        ? 'bg-green/10'
                        : line.type === 'remove'
                          ? 'bg-red/10'
                          : ''
                    }`}
                  >
                    <span className="text-subtext w-8 shrink-0 text-right pr-2 select-none border-r border-surface0">
                      {line.oldLineNumber ?? ''}
                    </span>
                    <span className="text-subtext w-8 shrink-0 text-right pr-2 select-none border-r border-surface0">
                      {line.newLineNumber ?? ''}
                    </span>
                    <span
                      className={`px-2 whitespace-pre ${
                        line.type === 'add'
                          ? 'text-green'
                          : line.type === 'remove'
                            ? 'text-red'
                            : 'text-text'
                      }`}
                    >
                      {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
                      {line.content}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
