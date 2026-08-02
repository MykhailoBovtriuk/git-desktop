import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useRepoStore } from '../../stores/repo-store';
import { useGitAction } from '../../hooks/use-git-action';
import { Button } from '../../shared/ui';

// A non-blocking bar shown while git is mid-rebase. Unlike MergeConflictModal it
// must NOT be a blocking Modal: resolving a rebase conflict happens in the
// Changes view (edit + stage the files), so the user has to keep reaching it
// while the bar stays visible. It sits above the main content in Shell.
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

  // The unmerged files are the 'U' entries in the working status — the same
  // conflict set the merge UI uses.
  const conflictCount = status.unstaged.filter(f => f.status === 'U').length;

  const handleAbort = () =>
    runGitAction(abortRebase, { title: t('abortRebase'), success: t('rebaseAborted') });

  // Continue rejects when conflicts remain unresolved; useGitAction shows the error.
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
