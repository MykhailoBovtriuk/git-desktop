import { useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { useGitAction } from '../../hooks/use-git-action';
import { DropdownPanel, MenuItem, SectionLabel, TextInput, cn } from '../../shared/ui';

interface BranchDropdownProps {
  onClose: () => void;
}

interface ItemProps {
  name: string;
  current: boolean;
  isRemote: boolean;
  contextOpen: boolean;
  onToggleContext: () => void;
  onCheckout: () => void;
  onMerge: () => void;
  onRebase: () => void;
  onDelete: () => void;
}

function BranchItem({
  name,
  current,
  isRemote,
  contextOpen,
  onToggleContext,
  onCheckout,
  onMerge,
  onRebase,
  onDelete,
}: ItemProps) {
  const { t } = useTranslation('branches');
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!contextOpen || !btnRef.current) {
      setPos(null);
      return;
    }
    const r = btnRef.current.getBoundingClientRect();
    const MENU_W = 176; // w-44
    const MENU_H = 152;
    let left = r.right + 4;
    if (left + MENU_W > window.innerWidth) left = r.left - MENU_W - 4;
    let top = r.top;
    if (top + MENU_H > window.innerHeight) top = window.innerHeight - MENU_H - 8;
    setPos({ top, left });
  }, [contextOpen]);

  return (
    <div className="relative">
      <div className="flex items-center justify-between w-full px-2 py-1.5 rounded hover:bg-surface1 text-sm">
        <button
          onClick={() => !current && onCheckout()}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          <span className={isRemote ? 'text-subtext' : 'text-blue'}>{isRemote ? '○' : '●'}</span>
          <span className="text-text truncate max-w-40">{name}</span>
        </button>
        {current && <span className="text-blue text-xs">✓</span>}
        <button
          ref={btnRef}
          onClick={e => {
            e.stopPropagation();
            onToggleContext();
          }}
          className="ml-2 px-1 text-subtext hover:text-text"
          aria-label={t('moreActions')}
        >
          ⋯
        </button>
      </div>

      {contextOpen &&
        pos &&
        createPortal(
          <div
            onMouseDown={e => e.stopPropagation()}
            className="fixed bg-surface1 rounded-lg shadow-xl z-[60] py-1 w-44"
            style={{ top: pos.top, left: pos.left }}
          >
            <MenuItem onClick={onCheckout}>{t('checkout')}</MenuItem>
            <MenuItem onClick={onMerge}>{t('mergeIntoCurrent')}</MenuItem>
            <MenuItem onClick={onRebase}>{t('rebaseOntoCurrent')}</MenuItem>
            {/* No delete for the checked-out branch — Git refuses it anyway. */}
            {!current && (
              <>
                <div className="border-t border-surface2 my-1" />
                <MenuItem tone="danger" onClick={onDelete}>
                  {isRemote ? t('deleteRemoteBranch') : t('deleteBranch')}
                </MenuItem>
              </>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}

export function BranchDropdown({ onClose }: BranchDropdownProps) {
  const { t } = useTranslation('branches');
  const [search, setSearch] = useState('');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const {
    branches,
    checkout,
    merge,
    rebase,
    deleteBranch,
    deleteRemoteBranch,
    mergeState,
    merging,
  } = useRepoStore(
    useShallow(s => ({
      branches: s.branches,
      checkout: s.checkout,
      merge: s.merge,
      rebase: s.rebase,
      deleteBranch: s.deleteBranch,
      deleteRemoteBranch: s.deleteRemoteBranch,
      mergeState: s.mergeState,
      merging: s.merging,
    })),
  );
  const { addToast, requestConfirm } = useUiStore(
    useShallow(s => ({ addToast: s.addToast, requestConfirm: s.requestConfirm })),
  );
  const runAction = useGitAction();

  const filtered = branches.filter(b => b.name.toLowerCase().includes(search.toLowerCase()));
  const local = filtered.filter(b => !b.remote);
  const remote = filtered.filter(b => b.remote);

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

  const toggleMenu = (name: string) => setOpenMenu(prev => (prev === name ? null : name));

  return (
    <DropdownPanel
      align="center"
      width="w-64"
      className={cn('p-2', merging || mergeState ? 'opacity-50 pointer-events-none' : '')}
    >
      <TextInput
        variant="search"
        autoFocus
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder={t('searchPlaceholder')}
        className="w-full mb-2"
      />

      <div className="max-h-[60vh] overflow-y-auto overflow-x-hidden">
        {local.length > 0 && (
          <>
            <SectionLabel>{t('local')}</SectionLabel>
            {local.map(b => (
              <BranchItem
                key={b.name}
                name={b.name}
                current={b.current}
                isRemote={false}
                contextOpen={openMenu === b.name}
                onToggleContext={() => toggleMenu(b.name)}
                onCheckout={() => handle(() => checkout(b.name), t('switchedTo', { name: b.name }))}
                onMerge={() => handle(() => merge(b.name), t('merged', { name: b.name }))}
                onRebase={() => handle(() => rebase(b.name), t('rebasedOnto', { name: b.name }))}
                onDelete={() => confirmDeleteLocal(b.name)}
              />
            ))}
          </>
        )}

        {remote.length > 0 && (
          <>
            <SectionLabel className="mt-1">{t('remote')}</SectionLabel>
            {remote.map(b => (
              <BranchItem
                key={b.name}
                name={b.name}
                current={b.current}
                isRemote={true}
                contextOpen={openMenu === b.name}
                onToggleContext={() => toggleMenu(b.name)}
                onCheckout={() => handle(() => checkout(b.name), t('switchedTo', { name: b.name }))}
                onMerge={() => handle(() => merge(b.name), t('merged', { name: b.name }))}
                onRebase={() => handle(() => rebase(b.name), t('rebasedOnto', { name: b.name }))}
                onDelete={() => confirmDeleteRemote(b.name)}
              />
            ))}
          </>
        )}
      </div>
    </DropdownPanel>
  );
}
