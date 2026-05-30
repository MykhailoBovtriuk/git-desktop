import { useState, useEffect, useRef } from 'react';
import { useRepoStore } from '../../stores/repo-store';
import { BranchDropdown } from '../dropdowns/BranchDropdown';
import { RepoDropdown } from '../dropdowns/RepoDropdown';
import { Badge, DragRegion } from '../../shared/ui';

export function Titlebar() {
  const { currentBranch, repoPath, mergeState } = useRepoStore();
  const [branchOpen, setBranchOpen] = useState(false);
  const [repoOpen, setRepoOpen] = useState(false);
  const branchRef = useRef<HTMLDivElement>(null);
  const repoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (branchRef.current && !branchRef.current.contains(e.target as Node)) setBranchOpen(false);
      if (repoRef.current && !repoRef.current.contains(e.target as Node)) setRepoOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const repoName = repoPath?.split('/').pop() ?? '';

  return (
    <DragRegion className="h-10 bg-mantle border-b border-surface0 flex items-center gap-4 shrink-0 select-none">
      {/* Space for macOS traffic lights (hiddenInset = ~80px) */}
      <div className="w-20 shrink-0" />
      <div className="flex items-center gap-2">
        <span className="text-text font-semibold text-sm">Git Desktop</span>
        <Badge variant="beta">Beta</Badge>
      </div>

      {/* flex-1 empty space — inherits drag from parent */}
      <div className="flex-1 flex justify-center">
        <DragRegion draggable={false} ref={branchRef} className="relative">
          <button
            onClick={() => !mergeState && setBranchOpen(o => !o)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface0 hover:bg-surface1 text-sm transition-colors ${mergeState ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <span className="text-blue">●</span>
            <span className="text-text">{currentBranch || 'no branch'}</span>
            <span className="text-subtext text-xs">▼</span>
          </button>
          {branchOpen && <BranchDropdown onClose={() => setBranchOpen(false)} />}
        </DragRegion>
      </div>

      <DragRegion draggable={false} ref={repoRef} className="relative pr-4">
        <button
          onClick={() => setRepoOpen(o => !o)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface0 hover:bg-surface1 text-sm transition-colors"
        >
          <span className="text-text truncate max-w-32">{repoName}</span>
          <span className="text-subtext text-xs">▼</span>
        </button>
        {repoOpen && <RepoDropdown onClose={() => setRepoOpen(false)} />}
      </DragRegion>
    </DragRegion>
  );
}
