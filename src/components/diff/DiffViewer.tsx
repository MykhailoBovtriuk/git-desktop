import { useEffect, useState } from 'react';
import { useUiStore } from '../../stores/ui-store';
import { useRepoStore } from '../../stores/repo-store';
import { gitApi } from '../../api/git-api';
import { parseDiff } from './parse-diff';
import type { FileDiff } from '../../types';


export function DiffViewer() {
  const { selectedFile, selectedCommit, activeView } = useUiStore();
  const isStaged = useRepoStore(
    s => !!selectedFile && s.status.staged.some(f => f.path === selectedFile),
  );
  const useCommitContext =
    (activeView === 'history' || activeView === 'graph') && !!selectedCommit;
  const [diffs, setDiffs] = useState<FileDiff[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedFile) { setDiffs([]); return; }

    let cancelled = false;
    setLoading(true);
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
          console.error('diff load failed:', err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedFile, selectedCommit, isStaged, useCommitContext]);

  if (!selectedFile) {
    return (
      <div className="h-full flex items-center justify-center text-subtext text-sm">
        Select a file to view diff
      </div>
    );
  }

  if (loading) {
    return <div className="h-full flex items-center justify-center text-subtext text-sm">Loading...</div>;
  }

  if (diffs.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-subtext text-sm gap-1">
        <span>No diff to display for</span>
        <span className="font-mono text-text">{selectedFile}</span>
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
                      line.type === 'add' ? 'bg-green/10' :
                      line.type === 'remove' ? 'bg-red/10' : ''
                    }`}
                  >
                    <span className="text-subtext w-8 shrink-0 text-right pr-2 select-none border-r border-surface0">
                      {line.oldLineNumber ?? ''}
                    </span>
                    <span className="text-subtext w-8 shrink-0 text-right pr-2 select-none border-r border-surface0">
                      {line.newLineNumber ?? ''}
                    </span>
                    <span className={`px-2 ${
                      line.type === 'add' ? 'text-green' :
                      line.type === 'remove' ? 'text-red' : 'text-text'
                    }`}>
                      {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}{line.content}
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
