import { useEffect, useState } from 'react';
import { useUiStore } from '../../stores/ui-store';
import { useRepoStore } from '../../stores/repo-store';
import { gitApi } from '../../api/git-api';
import { parseDiff } from './parse-diff';
import type { FileDiff } from '../../types';

export function DiffViewer() {
  const { selectedFile, selectedCommit } = useUiStore();
  const { status } = useRepoStore();
  const [diffs, setDiffs] = useState<FileDiff[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedFile) { setDiffs([]); return; }

    setLoading(true);
    const load = async () => {
      try {
        let raw = '';
        if (selectedCommit) {
          raw = await gitApi.getFileDiff(selectedCommit, selectedFile);
        } else {
          const isStaged = status.staged.some(f => f.path === selectedFile);
          raw = isStaged
            ? await gitApi.getStagedDiff(selectedFile)
            : await gitApi.getWorkingDiff(selectedFile);
        }
        setDiffs(parseDiff(raw));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedFile, selectedCommit, status]);

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
