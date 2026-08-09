import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useRepoStore } from '../../stores/repo-store';
import { useGitAction } from '../../hooks/use-git-action';
import { Button } from '../../shared/ui';

export function RebaseBanner() {
  const { t } = useTranslation('rebase');
  const runGitAction = useGitAction();
  const { rebasing, status, abortRebase, continueRebase } = useRepoStore(
    useShallow(s => ({
      rebasing: s.rebasing,
      status: s.status,
      abortRebase: s.abortRebase,
      continueRebase: s.continueRebase,
    })),
  );

  if (!rebasing) return null;

  const conflictCount = status.unstaged.filter(f => f.status === 'U').length;

  const handleAbort = () =>
    runGitAction(abortRebase, { title: t('abortRebase'), success: t('rebaseAborted') });

  const handleContinue = () =>
    runGitAction(continueRebase, { title: t('continueRebase'), success: t('rebaseContinued') });

  return (
    <div
      role="status"
      className="flex items-center gap-3 px-4 py-2 bg-surface0 border-b border-red/40"
    >
      <span className="text-red text-sm font-semibold">{t('rebaseConflict')}</span>
      <span className="text-subtext text-xs flex-1 truncate">
        {conflictCount > 0 ? t('conflictingFilesCount', { count: conflictCount }) : t('rebasing')}
      </span>
      <Button variant="secondary" onClick={handleAbort}>
        {t('abortRebase')}
      </Button>
      <Button variant="primary" onClick={handleContinue}>
        {t('continueRebase')}
      </Button>
    </div>
  );
}
