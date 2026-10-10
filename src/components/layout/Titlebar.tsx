import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useRepoStore } from '../../stores/repo-store';
import { BranchDropdown } from '../dropdowns/BranchDropdown';
import { RepoDropdown } from '../dropdowns/RepoDropdown';
import { AppMenuButtons } from './AppMenuButtons';
import { useDismiss } from '../../hooks/use-dismiss';
import { DragRegion, IconButton, RefreshIcon, TruncatedText } from '../../shared/ui';
import { TitlebarBrand, WindowControlsSpacer } from './TitlebarBrand';
import { basenameFromPath } from '../../lib/basename';

export function Titlebar() {
  const { t } = useTranslation('repo');
  const { currentBranch, repoPath, mergeState, refresh, lastRefreshError } = useRepoStore(
    useShallow(s => ({
      currentBranch: s.currentBranch,
      repoPath: s.repoPath,
      mergeState: s.mergeState,
      refresh: s.refresh,
      lastRefreshError: s.lastRefreshError,
    })),
  );
  const [branchOpen, setBranchOpen] = useState(false);
  const [repoOpen, setRepoOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const branchRef = useRef<HTMLDivElement>(null);
  const repoRef = useRef<HTMLDivElement>(null);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  useDismiss(branchRef, branchOpen, () => setBranchOpen(false));
  useDismiss(repoRef, repoOpen, () => setRepoOpen(false));

  const repoName = repoPath ? basenameFromPath(repoPath) : '';

  return (
    <DragRegion className="relative h-10 bg-mantle border-b border-surface0 flex items-center gap-4 shrink-0 select-none">
      <TitlebarBrand />

      <div className="flex-1 min-w-0" />

      {/* Centred on the window, not between the side blocks: those differ in
          width, so the group sat off-centre. */}
      <div className="absolute left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 max-w-[42%]">
        <DragRegion draggable={false} className="shrink-0">
          <AppMenuButtons />
        </DragRegion>
        <DragRegion draggable={false} ref={branchRef} className="relative min-w-0">
          <button
            onClick={() => !mergeState && setBranchOpen(o => !o)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface0 hover:bg-surface1 text-sm transition-colors min-w-0 ${mergeState ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <span className="text-blue shrink-0">●</span>
            <TruncatedText className="text-text">{currentBranch || t('noBranch')}</TruncatedText>
            <span className="text-subtext text-xs shrink-0">▼</span>
          </button>
          {branchOpen && <BranchDropdown onClose={() => setBranchOpen(false)} />}
        </DragRegion>
        <DragRegion draggable={false} className="shrink-0">
          <IconButton
            icon={RefreshIcon}
            spinning={refreshing}
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label={t('checkForChanges')}
            title={t('checkForChanges')}
          />
        </DragRegion>
        {lastRefreshError && (
          <span
            aria-label={t('refreshError')}
            title={lastRefreshError}
            className="text-yellow text-sm cursor-default select-none shrink-0"
          >
            ⚠
          </span>
        )}
      </div>

      <DragRegion draggable={false} ref={repoRef} className="relative pr-4 shrink-0">
        <button
          onClick={() => setRepoOpen(o => !o)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface0 hover:bg-surface1 text-sm transition-colors"
        >
          <TruncatedText className="text-text max-w-32">{repoName}</TruncatedText>
          <span className="text-subtext text-xs">▼</span>
        </button>
        {repoOpen && <RepoDropdown onClose={() => setRepoOpen(false)} />}
      </DragRegion>

      <WindowControlsSpacer />
    </DragRegion>
  );
}
