import { useState } from 'react';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';

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
          <button onClick={onCheckout} className="menu-item">Checkout</button>
          <button onClick={onMerge} className="menu-item">Merge into current</button>
          <button onClick={onRebase} className="menu-item">Rebase onto current</button>
          <div className="border-t border-surface2 my-1" />
          <button onClick={onDelete} className="menu-item text-red">Delete branch</button>
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
    <div
      className="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-surface0 rounded-lg shadow-xl z-50 w-64 p-2"
      style={{ opacity: mergeState ? 0.5 : 1, pointerEvents: mergeState ? 'none' : 'auto' }}
    >
      <input
        autoFocus
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search branches..."
        className="w-full bg-mantle text-text text-sm rounded px-2 py-1 mb-2 outline-none placeholder:text-subtext"
      />

      {local.length > 0 && (
        <>
          <p className="text-subtext text-xs uppercase tracking-wide px-2 py-1">Local</p>
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
          <p className="text-subtext text-xs uppercase tracking-wide px-2 py-1 mt-1">Remote</p>
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
    </div>
  );
}
