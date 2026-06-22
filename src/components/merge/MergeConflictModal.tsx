import { useTranslation } from 'react-i18next';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { Button, Modal } from '../../shared/ui';

export function MergeConflictModal() {
  const { t } = useTranslation('merge');
  const { mergeState, abortMerge } = useRepoStore();
  const { activeView, setActiveView, setActiveMergeFile, addToast } = useUiStore();

  if (!mergeState || activeView === 'merge-editor') return null;

  const handleAbort = async () => {
    try {
      await abortMerge();
      addToast({ variant: 'info', title: t('mergeAborted'), message: t('mergeAbortedMessage') });
    } catch (err: unknown) {
      addToast({ variant: 'error', title: t('abortFailed'), message: err instanceof Error ? err.message : String(err) });
    }
  };

  const handleResolve = () => {
    setActiveMergeFile(mergeState.conflictingFiles[0]);
    setActiveView('merge-editor');
  };

  return (
    <Modal
      title={t('mergeConflict')}
      titleVariant="danger"
      level="low"
      subtitle={t('merging', { source: mergeState.sourceBranch, target: mergeState.targetBranch })}
      footer={
        <>
          <Button variant="secondary" onClick={handleAbort}>{t('abortMerge')}</Button>
          <Button variant="primary" onClick={handleResolve}>{t('resolveConflicts')}</Button>
        </>
      }
    >
      <p className="text-text text-xs font-medium mb-2">
        {t('conflictingFilesCount', { count: mergeState.conflictingFiles.length })}
      </p>
      <div className="bg-mantle rounded-lg p-2 mb-4 max-h-40 overflow-y-auto">
        {mergeState.conflictingFiles.map(f => (
          <p key={f} className="text-red text-xs py-0.5">{f}</p>
        ))}
      </div>
    </Modal>
  );
}
