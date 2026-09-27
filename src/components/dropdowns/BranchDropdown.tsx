import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { DropdownPanel, SectionLabel, TextInput, cn } from '../../shared/ui';
import { BranchItem } from './BranchItem';
import { useBranchActions } from './useBranchActions';
import { useRemoteSync, type SyncOp } from '../../hooks/use-remote-sync';
import type { Branch } from '../../types';

interface BranchDropdownProps {
  onClose: () => void;
}

export function BranchDropdown({ onClose }: BranchDropdownProps) {
  const { t } = useTranslation('branches');
  const [search, setSearch] = useState('');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const { branches, mergeState, merging, aheadBehind, remoteHost } = useRepoStore(
    useShallow(s => ({
      branches: s.branches,
      mergeState: s.mergeState,
      merging: s.merging,
      aheadBehind: s.aheadBehind,
      remoteHost: s.remoteHost,
    })),
  );
  const { run, loading } = useRemoteSync();
  const openNewBranch = useUiStore(s => s.openNewBranch);
  const { checkout, merge, rebase, handle, confirmDeleteLocal, confirmDeleteRemote } =
    useBranchActions(onClose);

  const filtered = branches.filter(b => b.name.toLowerCase().includes(search.toLowerCase()));
  const local = filtered.filter(b => !b.remote);
  const remote = filtered.filter(b => b.remote);

  const toggleMenu = (name: string) => setOpenMenu(prev => (prev === name ? null : name));

  const syncable = (b: Branch) => !!remoteHost && b.current && !b.remote;
  const runAndClose = (op: SyncOp) => {
    onClose();
    void run(op);
  };

  const renderItem = (b: Branch) => (
    <BranchItem
      key={b.name}
      name={b.name}
      current={b.current}
      isRemote={b.remote}
      contextOpen={openMenu === b.name}
      onToggleContext={() => toggleMenu(b.name)}
      onPull={syncable(b) && aheadBehind.upstream ? () => runAndClose('pull') : undefined}
      onPush={syncable(b) && aheadBehind.upstream ? () => runAndClose('push') : undefined}
      onPublish={syncable(b) && !aheadBehind.upstream ? () => runAndClose('publish') : undefined}
      ahead={b.current ? aheadBehind.ahead : 0}
      behind={b.current ? aheadBehind.behind : 0}
      onCheckout={() => handle(() => checkout(b.name), t('switchedTo', { name: b.name }))}
      onMerge={() => handle(() => merge(b.name), t('merged', { name: b.name }))}
      onRebase={() => handle(() => rebase(b.name), t('rebasedOnto', { name: b.name }))}
      onDelete={() => (b.remote ? confirmDeleteRemote(b.name) : confirmDeleteLocal(b.name))}
    />
  );

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
        {/* The header row stays when the filter matches nothing: that is
            exactly when the user wants to create the branch. */}
        <div className="flex items-center justify-between">
          <SectionLabel>{t('local')}</SectionLabel>
          <button
            onClick={() => {
              onClose();
              openNewBranch();
            }}
            className="text-blue text-xs hover:underline px-2 py-1"
          >
            {t('new')}
          </button>
        </div>
        {local.map(renderItem)}

        {/* Fetch is what fills this section, so its header shows whenever
            there is a remote — even before the first fetch brought anything. */}
        {(remoteHost || remote.length > 0) && (
          <>
            <div className="flex items-center justify-between mt-1">
              <SectionLabel>{t('remote')}</SectionLabel>
              {remoteHost && (
                <button
                  onClick={() => void run('fetch')}
                  disabled={!!loading}
                  className="text-blue text-xs hover:underline disabled:opacity-60 disabled:no-underline px-2 py-1"
                >
                  {loading === 'fetch' ? t('fetching') : t('fetch')}
                </button>
              )}
            </div>
            {remote.map(renderItem)}
          </>
        )}
      </div>
    </DropdownPanel>
  );
}
