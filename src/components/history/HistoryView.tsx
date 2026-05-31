import { useState, useEffect } from 'react';
import { useUiStore } from '../../stores/ui-store';
import { useRepoStore } from '../../stores/repo-store';
import { gitApi } from '../../api/git-api';
import { CommitList } from './CommitList';
import { DiffViewer } from '../diff/DiffViewer';
import { TextInput } from '../../shared/ui';

export function HistoryView() {
  const { setActiveView, selectedCommit, setSelectedFile, selectedFile } = useUiStore();
  const { commits } = useRepoStore();
  const [filter, setFilter] = useState('');
  const [changedFiles, setChangedFiles] = useState<{ path: string; status: string }[]>([]);

  const commit = commits.find(c => c.hash === selectedCommit);

  useEffect(() => {
    if (!selectedCommit) { setChangedFiles([]); return; }
    gitApi.getCommitDiff(selectedCommit).then(setChangedFiles);
  }, [selectedCommit]);

  return (
    <div className="flex h-full">
      {/* Left panel: commit list */}
      <div className="w-72 border-r border-surface0 flex flex-col shrink-0">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-surface0 shrink-0">
          <button
            onClick={() => setActiveView('changes')}
            className="text-blue text-xs hover:underline"
          >
            ← Back
          </button>
          <TextInput
            variant="filter"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter commits..."
            className="flex-1"
          />
        </div>
        <CommitList filter={filter} />
      </div>

      {/* Right panel: commit detail + diff */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {commit ? (
          <>
            <div className="px-4 py-3 border-b border-surface0 shrink-0">
              <p className="text-text text-sm font-medium">{commit.message}</p>
              <p className="text-subtext text-xs mt-1">{commit.author} · {commit.hash}</p>
            </div>
            <div className="flex h-full overflow-hidden">
              {/* Changed files list */}
              <div className="w-48 border-r border-surface0 overflow-y-auto shrink-0">
                {changedFiles.map(f => (
                  <button
                    key={f.path}
                    onClick={() => setSelectedFile(f.path)}
                    className={`w-full text-left px-3 py-1.5 text-xs border-l-2 transition-colors truncate ${
                      selectedFile === f.path
                        ? 'bg-surface1 border-blue text-text'
                        : 'border-transparent hover:bg-surface0 text-subtext'
                    }`}
                  >
                    {f.path.split('/').pop()}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-hidden">
                <DiffViewer />
              </div>
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center text-subtext text-sm">
            Select a commit to view diff
          </div>
        )}
      </div>
    </div>
  );
}
