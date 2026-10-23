import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { useGitAction } from '../../hooks/use-git-action';
import { errorMessage } from '../../lib/error-message';

export function useBranchActions(onClose: () => void) {
  const { t } = useTranslation('branches');
  const { checkout, merge, rebase, deleteBranch, deleteRemoteBranch } = useRepoStore(
    useShallow(s => ({
      checkout: s.checkout,
      merge: s.merge,
      rebase: s.rebase,
      deleteBranch: s.deleteBranch,
      deleteRemoteBranch: s.deleteRemoteBranch,
    })),
  );
  const { addToast, confirmDanger } = useUiStore(
    useShallow(s => ({ addToast: s.addToast, confirmDanger: s.confirmDanger })),
  );
  const runAction = useGitAction();

  const handle = async (action: () => Promise<void>, successMsg: string) => {
    onClose();
    await runAction(action, {
      title: t('common:error'),
      successTitle: t('common:done'),
      success: successMsg,
    });
  };

  const confirmDeleteLocal = async (name: string) => {
    const confirmed = await confirmDanger(t('deleteBranch'), t('deleteConfirm', { name }));
    if (!confirmed) return;
    onClose();
    try {
      await deleteBranch(name);
      addToast({ variant: 'success', title: t('common:done'), message: t('deleted', { name }) });
    } catch (err: unknown) {
      const msg = errorMessage(err);
      if (/not fully merged/i.test(msg)) {
        const force = await confirmDanger(t('deleteBranch'), t('forceDeleteConfirm', { name }));
        if (force) {
          await runAction(() => deleteBranch(name, true), {
            title: t('common:error'),
            successTitle: t('common:done'),
            success: t('forceDeleted', { name }),
          });
        }
        return;
      }
      void runAction(() => Promise.reject(err), { title: t('common:error') });
    }
  };

  const confirmDeleteRemote = async (name: string) => {
    const slash = name.indexOf('/');
    if (slash === -1) return;
    const remote = name.slice(0, slash);
    const branch = name.slice(slash + 1);
    const confirmed = await confirmDanger(
      t('deleteRemoteBranch'),
      t('deleteRemoteConfirm', { branch, remote }),
    );
    if (confirmed) {
      void handle(() => deleteRemoteBranch(remote, branch), t('deleted', { name }));
    }
  };

  return { checkout, merge, rebase, handle, confirmDeleteLocal, confirmDeleteRemote };
}
