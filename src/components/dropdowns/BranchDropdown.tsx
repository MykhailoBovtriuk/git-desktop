import { useState } from 'react';
import { useRepoStore, CheckoutConflictError } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
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

function BranchItem({ name, current, isRemote, contextOpen, onToggleContext, onCheckout, onMerge, onRebase, onDelete }: ItemProps) {
  return (
    <div className="relative">
      <div className="flex items-center justify-between w-full px-2 py-1.5 rounded hover:bg-surface1 text-sm">
        <button
          onClick={() => !current && onCheckout()}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          <span className={isRemote ? 'text-subtext' : 'text-blue'}>
            {isRemote ? '○' : '●'}
          </span>
          <span className="text-text truncate max-w-40">{name}</span>
        </button>
        {current && <span className="text-blue text-xs">✓</span>}
        <button
          onClick={e => { e.stopPropagation(); onToggleContext(); }}
          className="ml-2 px-1 text-subtext hover:text-text"
          aria-label="More actions"
        >
          ⋯
        </button>
      </div>

      {contextOpen && (
        <div className="absolute left-full top-0 ml-1 bg-surface1 rounded-lg shadow-xl z-10 py-1 w-44">
          <MenuItem onClick={onCheckout}>Checkout</MenuItem>
          <MenuItem onClick={onMerge}>Merge into current</MenuItem>
          <MenuItem onClick={onRebase}>Rebase onto current</MenuItem>
          <div className="border-t border-surface2 my-1" />
          <MenuItem tone="danger" onClick={onDelete}>Delete branch</MenuItem>
        </div>
      )}
    </div>
  );
}

export function BranchDropdown({ onClose }: BranchDropdownProps) {
  const [search, setSearch] = useState('');
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const { branches, checkout, merge, rebase, deleteBranch, mergeState } = useRepoStore();
  const { addToast } = useUiStore();

  const filtered = branches.filter(b =>
    b.name.toLowerCase().includes(search.toLowerCase())
  );
  const local = filtered.filter(b => !b.remote);
  const remote = filtered.filter(b => b.remote);

  const handle = async (action: () => Promise<void>, successMsg: string) => {
    onClose();
    try {
      await action();
      addToast({ variant: 'success', title: 'Done', message: successMsg });
    } catch (err: unknown) {
      // Checkout blocked by local changes — a modal handles it, no error toast.
      if (err instanceof CheckoutConflictError) return;
      addToast({ variant: 'error', title: 'Error', message: err instanceof Error ? err.message : String(err) });
    }
  };

  const confirmDelete = (name: string) => {
    if (window.confirm(`Delete branch "${name}"? This cannot be undone.`)) {
      handle(() => deleteBranch(name), `Deleted ${name}`);
    }
  };

  const toggleMenu = (name: string) =>
    setOpenMenu(prev => (prev === name ? null : name));

  return (
    <DropdownPanel
      align="center"
      width="w-64"
      className={cn('p-2', mergeState ? 'opacity-50 pointer-events-none' : '')}
    >
      <TextInput
        variant="search"
        autoFocus
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search branches..."
        className="w-full mb-2"
      />

      {local.length > 0 && (
        <>
          <SectionLabel>Local</SectionLabel>
          {local.map(b => (
            <BranchItem
              key={b.name}
              name={b.name}
              current={b.current}
              isRemote={false}
              contextOpen={openMenu === b.name}
              onToggleContext={() => toggleMenu(b.name)}
              onCheckout={() => handle(() => checkout(b.name), `Switched to ${b.name}`)}
              onMerge={() => handle(() => merge(b.name), `Merged ${b.name}`)}
              onRebase={() => handle(() => rebase(b.name), `Rebased onto ${b.name}`)}
              onDelete={() => confirmDelete(b.name)}
            />
          ))}
        </>
      )}

      {remote.length > 0 && (
        <>
          <SectionLabel className="mt-1">Remote</SectionLabel>
          {remote.map(b => (
            <BranchItem
              key={b.name}
              name={b.name}
              current={b.current}
              isRemote={true}
              contextOpen={openMenu === b.name}
              onToggleContext={() => toggleMenu(b.name)}
              onCheckout={() => handle(() => checkout(b.name), `Switched to ${b.name}`)}
              onMerge={() => handle(() => merge(b.name), `Merged ${b.name}`)}
              onRebase={() => handle(() => rebase(b.name), `Rebased onto ${b.name}`)}
              onDelete={() => confirmDelete(b.name)}
            />
          ))}
        </>
      )}
    </DropdownPanel>
  );
}
