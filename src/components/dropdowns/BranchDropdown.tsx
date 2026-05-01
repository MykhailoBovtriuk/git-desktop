import { useState } from 'react';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';

interface BranchDropdownProps {
  onClose: () => void;
}

export function BranchDropdown({ onClose }: BranchDropdownProps) {
  const [search, setSearch] = useState('');
  const [contextMenu, setContextMenu] = useState<{ branch: string } | null>(null);
  const { branches, currentBranch, checkout, merge, rebase, deleteBranch, mergeState } = useRepoStore();
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

  const BranchItem = ({ name, current, remote: isRemote }: { name: string; current: boolean; remote: boolean }) => (
    <div className="relative group">
      <button
        className="flex items-center justify-between w-full px-2 py-1.5 rounded hover:bg-surface1 text-sm text-left"
        onClick={() => {
          if (!current) handle(() => checkout(name), `Switched to ${name}`);
        }}
        onMouseEnter={() => setContextMenu({ branch: name })}
      >
        <div className="flex items-center gap-2">
          <span className={isRemote ? 'text-subtext' : 'text-blue'}>
            {isRemote ? '○' : '●'}
          </span>
          <span className="text-text truncate max-w-40">{name}</span>
        </div>
        {current && <span className="text-blue text-xs">✓</span>}
      </button>

      {contextMenu?.branch === name && (
        <div
          className="absolute left-full top-0 ml-1 bg-surface1 rounded-lg shadow-xl z-10 py-1 w-44"
          onMouseLeave={() => setContextMenu(null)}
        >
          <button onClick={() => handle(() => checkout(name), `Switched to ${name}`)} className="menu-item">Checkout</button>
          <button onClick={() => handle(() => merge(name), `Merged ${name}`)} className="menu-item">Merge into current</button>
          <button onClick={() => handle(() => rebase(name), `Rebased onto ${name}`)} className="menu-item">Rebase onto current</button>
          <div className="border-t border-surface2 my-1" />
          <button
            onClick={() => handle(() => deleteBranch(name), `Deleted ${name}`)}
            className="menu-item text-red"
          >
            Delete branch
          </button>
        </div>
      )}
    </div>
  );

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
          {local.map(b => <BranchItem key={b.name} {...b} />)}
        </>
      )}

      {remote.length > 0 && (
        <>
          <p className="text-subtext text-xs uppercase tracking-wide px-2 py-1 mt-1">Remote</p>
          {remote.map(b => <BranchItem key={b.name} {...b} />)}
        </>
      )}
    </div>
  );
}
