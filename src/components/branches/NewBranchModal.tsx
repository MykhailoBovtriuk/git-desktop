import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { useGitAction } from '../../hooks/use-git-action';
import { Button, Modal, TextInput } from '../../shared/ui';

/**
 * Naming a new branch, and — only when there is something to decide — saying
 * what should happen to uncommitted work.
 *
 * Two steps in one dialog rather than two dialogs: the second is a consequence
 * of the first, and on a clean tree it never appears at all.
 */
export function NewBranchModal() {
  const { t } = useTranslation('branches');
  const { newBranchOpen, closeNewBranch, addToast } = useUiStore(
    useShallow(s => ({
      newBranchOpen: s.newBranchOpen,
      closeNewBranch: s.closeNewBranch,
      addToast: s.addToast,
    })),
  );
  const { createBranch, currentBranch, status } = useRepoStore(
    useShallow(s => ({
      createBranch: s.createBranch,
      currentBranch: s.currentBranch,
      status: s.status,
    })),
  );
  const runAction = useGitAction();

  const [name, setName] = useState('');
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!newBranchOpen) return null;

  const trimmed = name.trim();
  const hasChanges = status.staged.length + status.unstaged.length > 0;

  const close = () => {
    setName('');
    setAsking(false);
    closeNewBranch();
  };

  const create = (changes: 'bring' | 'leave') => async () => {
    if (busy) return;
    setBusy(true);
    try {
      const ok = await runAction(() => createBranch(trimmed, changes), { title: t('createFailed') });
      // A name already taken, or a ref git refuses: the dialog stays open with
      // the name still in it, so the fix is one edit away rather than a retype.
      if (!ok) return;
      addToast({
        variant: 'success',
        title: t('common:done'),
        message: t(changes === 'leave' ? 'createdLeft' : 'created', {
          name: trimmed,
          branch: currentBranch,
        }),
      });
      close();
    } finally {
      setBusy(false);
    }
  };

  // Nothing uncommitted means nothing to ask about.
  const submitName = () => {
    if (!trimmed) return;
    if (hasChanges) setAsking(true);
    else void create('bring')();
  };

  if (asking) {
    return (
      <Modal
        title={t('changesTitle')}
        width="w-[75%] max-w-xl"
        subtitle={t('changesSubtitle', { name: trimmed, branch: currentBranch })}
        onClose={close}
        footer={
          <Button variant="secondary" size="sm" disabled={busy} onClick={close}>
            {t('common:cancel')}
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-subtext text-xs mb-1">{t('bringDesc', { name: trimmed })}</p>
            <Button variant="primary" fullWidth disabled={busy} onClick={create('bring')}>
              {t('bringAction')}
            </Button>
          </div>

          <div>
            <p className="text-subtext text-xs mb-1">{t('leaveDesc', { branch: currentBranch })}</p>
            <Button variant="secondary" fullWidth disabled={busy} onClick={create('leave')}>
              {t('leaveAction')}
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title={t('newTitle')}
      subtitle={t('newSubtitle', { branch: currentBranch })}
      onClose={close}
      footer={
        <>
          <Button variant="secondary" size="sm" disabled={busy} onClick={close}>
            {t('common:cancel')}
          </Button>
          <Button variant="primary" size="sm" disabled={busy || !trimmed} onClick={submitName}>
            {t('create')}
          </Button>
        </>
      }
    >
      <TextInput
        variant="modal"
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === 'Enter' && submitName()}
        placeholder={t('namePlaceholder')}
        className="w-full"
      />
    </Modal>
  );
}
