import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useUiStore } from '../../stores/ui-store';
import { useRepoStore } from '../../stores/repo-store';
import { gitApi } from '../../api/git-api';
import { CommitList } from './CommitList';
import { DiffViewer } from '../diff/DiffViewer';
import { TextInput } from '../../shared/ui';

export function HistoryView() {
  const { t } = useTranslation();
  const { setActiveView, selectedCommit, setSelectedFile, selectedFile, addToast } = useUiStore(
    useShallow(s => ({
      setActiveView: s.setActiveView,
      selectedCommit: s.selectedCommit,
      setSelectedFile: s.setSelectedFile,
      selectedFile: s.selectedFile,
      addToast: s.addToast,
    })),
  );
  const { commits } = useRepoStore(useShallow(s => ({ commits: s.commits })));
  const [filter, setFilter] = useState('');
  const [changedFiles, setChangedFiles] = useState<{ path: string; status: string }[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const commit = commits.find(c => c.hash === selectedCommit);

  useEffect(() => {
    // A file selected under the previous commit is meaningless for the new
    // one — clear it so DiffViewer doesn't request a stale (commit, file)
    // pair and the file list doesn't highlight a path that may not exist.
    setSelectedFile(null);

    if (!selectedCommit) { setChangedFiles([]); return; }

    // Guard against a stale response overwriting files for a newer selection,
    // and surface load failures instead of crashing on an unhandled rejection.
    let cancelled = false;
    setLoadingFiles(true);
    (async () => {
      try {
        const files = await gitApi.getCommitDiff(selectedCommit);
        if (!cancelled) setChangedFiles(files);
      } catch (err) {
        if (!cancelled) {
          setChangedFiles([]);
          console.error('commit diff load failed:', err);
          addToast({
            variant: 'error',
            title: t('error'),
            message: err instanceof Error ? err.message : String(err),
          });
        }
      } finally {
        if (!cancelled) setLoadingFiles(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedCommit, setSelectedFile, addToast]);

  return (
    <div className="flex h-full">
      {/* Left panel: commit list */}
      <div className="w-72 border-r border-surface0 flex flex-col shrink-0">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-surface0 shrink-0">
          <button
            onClick={() => setActiveView('changes')}
            className="text-blue text-xs hover:underline"
          >
            ← {t('back')}
          </button>
          <TextInput
            variant="filter"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder={t('filterCommits')}
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
                {loadingFiles && changedFiles.length === 0 && (
                  <p className="px-3 py-2 text-subtext text-xs">{t('loading')}</p>
                )}
                {changedFiles.map(f => (
                  <button
                    key={f.path}
                    onClick={() => setSelectedFile(f.path, 'commit')}
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
            {t('selectCommitHint')}
          </div>
        )}
      </div>
    </div>
  );
}
