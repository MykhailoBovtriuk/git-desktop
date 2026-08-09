import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { useGitAction } from '../../hooks/use-git-action';

// Branch operations (checkout/merge/rebase) plus the two multi-step delete
// confirmation flows, wired to toasts and the shared error classifier. `onClose`
// dismisses the dropdown before an action runs.
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
  const { addToast, requestConfirm } = useUiStore(
    useShallow(s => ({ addToast: s.addToast, requestConfirm: s.requestConfirm })),
  );
  const runAction = useGitAction();

  const handle = async (action: () => Promise<void>, successMsg: string) => {
    onClose();
    // CheckoutConflictError is swallowed by the hook — a modal handles it.
    const ok = await runAction(action, { title: t('common:error') });
    if (ok) addToast({ variant: 'success', title: t('common:done'), message: successMsg });
  };

  // Local delete: try the safe (non-force) delete first; only if Git reports
  // the branch isn't fully merged do we offer a force delete behind a second,
  // explicit confirm that spells out the consequence.
  const confirmDeleteLocal = async (name: string) => {
    const confirmed = await requestConfirm({
      title: t('deleteBranch'),
      message: t('deleteConfirm', { name }),
      confirmLabel: t('deleteBranch'),
      danger: true,
    });
    if (!confirmed) return;
    onClose();
    try {
      await deleteBranch(name);
      addToast({ variant: 'success', title: t('common:done'), message: t('deleted', { name }) });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/not fully merged/i.test(msg)) {
        const force = await requestConfirm({
          title: t('deleteBranch'),
          message: t('forceDeleteConfirm', { name }),
          confirmLabel: t('deleteBranch'),
          danger: true,
        });
        if (force) {
          const ok = await runAction(() => deleteBranch(name, true), { title: t('common:error') });
          if (ok)
            addToast({
              variant: 'success',
              title: t('common:done'),
              message: t('forceDeleted', { name }),
            });
        }
        return;
      }
      // Re-route through the shared classifier so this toast matches the rest.
      void runAction(() => Promise.reject(err), { title: t('common:error') });
    }
  };

  // Remote delete: branch name arrives as "<remote>/<branch>" (e.g. origin/dev).
  const confirmDeleteRemote = async (name: string) => {
    const slash = name.indexOf('/');
    if (slash === -1) return;
    const remote = name.slice(0, slash);
    const branch = name.slice(slash + 1);
    const confirmed = await requestConfirm({
      title: t('deleteRemoteBranch'),
      message: t('deleteRemoteConfirm', { branch, remote }),
      confirmLabel: t('deleteRemoteBranch'),
      danger: true,
    });
    if (confirmed) {
      void handle(() => deleteRemoteBranch(remote, branch), t('deleted', { name }));
    }
  };

  return { checkout, merge, rebase, handle, confirmDeleteLocal, confirmDeleteRemote };
}
