import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useRepoStore } from '../stores/repo-store';
import { useBusy } from './use-busy';
import { useGitAction } from './use-git-action';

export type SyncOp = 'fetch' | 'pull' | 'push' | 'publish';

export function useRemoteSync() {
  const { t } = useTranslation('sync');
  const actions: Record<SyncOp, () => Promise<unknown>> = useRepoStore(
    useShallow(s => ({ fetch: s.fetch, pull: s.pull, push: s.push, publish: s.publishBranch })),
  );
  const runAction = useGitAction();
  const [, track] = useBusy();
  const [loading, setLoading] = useState<SyncOp | null>(null);

  const run = async (op: SyncOp): Promise<void> => {
    const label = op === 'publish' ? t('publishBranch') : t(op);
    await track(async () => {
      setLoading(op);
      try {
        await runAction(actions[op], {
          title: t('failed', { op: label }),
          successTitle: label,
          success: result =>
            op === 'pull' && typeof result === 'string' ? result : t('success', { op: label }),
        });
      } finally {
        setLoading(null);
      }
    });
  };

  return { run, loading };
}
