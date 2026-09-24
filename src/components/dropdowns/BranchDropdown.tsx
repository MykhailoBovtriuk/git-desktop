import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { DropdownPanel, SectionLabel, TextInput, cn } from '../../shared/ui';
import { BranchItem } from './BranchItem';
import { useBranchActions } from './useBranchActions';
import type { Branch } from '../../types';

interface BranchDropdownProps {
  onClose: () => void;
}

export function BranchDropdown({ onClose }: BranchDropdownProps) {
  const { t } = useTranslation('branches');
  const [search, setSearch] = useState('');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const { branches, mergeState, merging } = useRepoStore(
    useShallow(s => ({ branches: s.branches, mergeState: s.mergeState, merging: s.merging })),
  );
  const openNewBranch = useUiStore(s => s.openNewBranch);
  const { checkout, merge, rebase, handle, confirmDeleteLocal, confirmDeleteRemote } =
    useBranchActions(onClose);

  const filtered = branches.filter(b => b.name.toLowerCase().includes(search.toLowerCase()));
  const local = filtered.filter(b => !b.remote);
  const remote = filtered.filter(b => b.remote);

  const toggleMenu = (name: string) => setOpenMenu(prev => (prev === name ? null : name));

  const renderItem = (b: Branch) => (
    <BranchItem
      key={b.name}
      name={b.name}
      current={b.current}
      isRemote={b.remote}
      contextOpen={openMenu === b.name}
      onToggleContext={() => toggleMenu(b.name)}
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
        {/* The header row stays even when the filter matches nothing locally:
            typing a name that does not exist yet is exactly when creating it is
            the thing you want, and hiding the row hid the way to do it. */}
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

        {remote.length > 0 && (
          <>
            <SectionLabel className="mt-1">{t('remote')}</SectionLabel>
            {remote.map(renderItem)}
          </>
        )}
      </div>
    </DropdownPanel>
  );
}
