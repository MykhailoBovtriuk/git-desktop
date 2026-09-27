import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useRepoStore } from '../stores/repo-store';
import { useGitAction } from './use-git-action';

export type SyncOp = 'fetch' | 'pull' | 'push' | 'publish';

export function useRemoteSync() {
  const { t } = useTranslation('sync');
  const actions: Record<SyncOp, () => Promise<unknown>> = useRepoStore(
    useShallow(s => ({ fetch: s.fetch, pull: s.pull, push: s.push, publish: s.publishBranch })),
  );
  const runAction = useGitAction();
  const [loading, setLoading] = useState<SyncOp | null>(null);
  // `loading` only disables the buttons after a re-render; a quick double click
  // lands before that.
  const inFlight = useRef(false);

  const run = async (op: SyncOp): Promise<void> => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(op);
    const label = op === 'publish' ? t('publishBranch') : t(op);
    try {
      await runAction(actions[op], {
        title: t('failed', { op: label }),
        successTitle: label,
        success: result =>
          op === 'pull' && typeof result === 'string' ? result : t('success', { op: label }),
      });
    } finally {
      inFlight.current = false;
      setLoading(null);
    }
  };

  return { run, loading };
}
