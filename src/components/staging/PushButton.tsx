import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useRepoStore } from '../../stores/repo-store';
import { useRemoteSync } from '../../hooks/use-remote-sync';
import { Button } from '../../shared/ui';

/** Push right under Commit — shown only while there is something to send. */
export function PushButton() {
  const { t } = useTranslation('staging');
  const { remoteHost, currentBranch, headCommit, aheadBehind } = useRepoStore(
    useShallow(s => ({
      remoteHost: s.remoteHost,
      currentBranch: s.currentBranch,
      headCommit: s.headCommit,
      aheadBehind: s.aheadBehind,
    })),
  );
  const { run, loading } = useRemoteSync();

  // Detached or unborn HEAD has no branch to send.
  if (!remoteHost || !currentBranch || !headCommit) return null;
  const { ahead, behind, upstream } = aheadBehind;
  // An unpublished branch is all "something to send", commits or not.
  const publish = !upstream;
  if (!publish && ahead === 0) return null;
  // The remote would reject it: say so up front instead of in a failure toast.
  const blocked = !publish && behind > 0;

  return (
    <Button
      variant="surface"
      size="sm"
      fullWidth
      onClick={() => void run(publish ? 'publish' : 'push')}
      disabled={!!loading || blocked}
      title={blocked ? t('pullFirst', { count: behind }) : undefined}
      className="py-1.5 font-medium"
    >
      {loading ? (
        '...'
      ) : publish ? (
        t('publishBranch')
      ) : (
        <span className="inline-flex items-center gap-1.5">
          {t('push')}
          <span className="text-blue text-xs">↑{ahead}</span>
        </span>
      )}
    </Button>
  );
}
