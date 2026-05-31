import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { Button, Modal } from '../../shared/ui';

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
    <Modal
      title="Merge Conflict"
      titleVariant="danger"
      level="low"
      subtitle={
        <>
          Merging <span className="text-blue">{mergeState.sourceBranch}</span> into{' '}
          <span className="text-text">{mergeState.targetBranch}</span>
        </>
      }
      footer={
        <>
          <Button variant="secondary" onClick={handleAbort}>Abort Merge</Button>
          <Button variant="primary" onClick={handleResolve}>Resolve Conflicts</Button>
        </>
      }
    >
      <p className="text-text text-xs font-medium mb-2">
        {mergeState.conflictingFiles.length} conflicting file
        {mergeState.conflictingFiles.length !== 1 ? 's' : ''}:
      </p>
      <div className="bg-mantle rounded-lg p-2 mb-4 max-h-40 overflow-y-auto">
        {mergeState.conflictingFiles.map(f => (
          <p key={f} className="text-red text-xs py-0.5">{f}</p>
        ))}
      </div>
    </Modal>
  );
}
