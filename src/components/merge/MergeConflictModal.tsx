import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';

export function MergeConflictModal() {
  const { mergeState, abortMerge } = useRepoStore();
  const { activeView, setActiveView, setActiveMergeFile, addToast } = useUiStore();

  if (!mergeState || activeView === 'merge-editor') return null;

  const handleAbort = async () => {
    try {
      await abortMerge();
      addToast({ variant: 'info', title: 'Merge aborted', message: 'Merge was aborted successfully' });
    } catch (err: unknown) {
      addToast({ variant: 'error', title: 'Abort failed', message: err instanceof Error ? err.message : String(err) });
    }
  };

  const handleResolve = () => {
    setActiveMergeFile(mergeState.conflictingFiles[0]);
    setActiveView('merge-editor');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-40">
      <div className="bg-surface0 rounded-xl p-6 w-96 shadow-xl">
        <h2 className="text-red text-lg font-semibold mb-1">Merge Conflict</h2>
        <p className="text-subtext text-sm mb-4">
          Merging <span className="text-blue">{mergeState.sourceBranch}</span> into{' '}
          <span className="text-text">{mergeState.targetBranch}</span>
        </p>
        <p className="text-text text-xs font-medium mb-2">
          {mergeState.conflictingFiles.length} conflicting file{mergeState.conflictingFiles.length !== 1 ? 's' : ''}:
        </p>
        <div className="bg-mantle rounded-lg p-2 mb-4 max-h-40 overflow-y-auto">
          {mergeState.conflictingFiles.map(f => (
            <p key={f} className="text-red text-xs py-0.5">{f}</p>
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={handleAbort}
            className="px-3 py-1.5 text-sm text-subtext hover:text-text transition-colors"
          >
            Abort Merge
          </button>
          <button
            onClick={handleResolve}
            className="px-3 py-1.5 text-sm bg-blue text-mantle rounded hover:opacity-90 transition-opacity"
          >
            Resolve Conflicts
          </button>
        </div>
      </div>
    </div>
  );
}
