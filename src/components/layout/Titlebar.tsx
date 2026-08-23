import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useRepoStore } from '../../stores/repo-store';
import { BranchDropdown } from '../dropdowns/BranchDropdown';
import { RepoDropdown } from '../dropdowns/RepoDropdown';
import { ProfileDropdown } from '../dropdowns/ProfileDropdown';
import { Badge, DragRegion, IconButton, RefreshIcon, ProfileIcon } from '../../shared/ui';
import { basenameFromPath } from '../../lib/basename';
import { useSettingsStore } from '../../stores/settings-store';
import { matchProfile } from '../../lib/git-profile';

export function Titlebar() {
  const { t } = useTranslation('repo');
  const { t: tSettings } = useTranslation('settings');
  const { currentBranch, repoPath, mergeState, refresh, lastRefreshError, identity } = useRepoStore(
    useShallow(s => ({
      currentBranch: s.currentBranch,
      repoPath: s.repoPath,
      mergeState: s.mergeState,
      refresh: s.refresh,
      lastRefreshError: s.lastRefreshError,
      identity: s.identity,
    })),
  );
  const profiles = useSettingsStore(s => s.profiles);
  const activeProfile = matchProfile(identity, profiles);
  const [branchOpen, setBranchOpen] = useState(false);
  const [repoOpen, setRepoOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const branchRef = useRef<HTMLDivElement>(null);
  const repoRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (branchRef.current && !branchRef.current.contains(e.target as Node)) setBranchOpen(false);
      if (repoRef.current && !repoRef.current.contains(e.target as Node)) setRepoOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const repoName = repoPath ? basenameFromPath(repoPath) : '';

  const isMac = (window.electronAPI?.platform ?? 'darwin') === 'darwin';

  return (
    <DragRegion className="relative h-10 bg-mantle border-b border-surface0 flex items-center gap-4 shrink-0 select-none">
      <div className={isMac ? 'w-20 shrink-0' : 'w-3 shrink-0'} />
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-text font-semibold text-sm">Git Desktop</span>
        <Badge variant="beta">Beta</Badge>
      </div>

      <div className="flex-1 min-w-0" />

      {/* Centred on the window, not on the space left over between the side
          blocks. Those differ in width (app name on the left vs repo pill plus
          the room reserved for the OS window controls on the right), so a
          flex-centred group ended up visibly off-centre on Windows. */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 max-w-[42%]">
        <DragRegion draggable={false} ref={branchRef} className="relative min-w-0">
          <button
            onClick={() => !mergeState && setBranchOpen(o => !o)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded bg-surface0 hover:bg-surface1 text-sm transition-colors min-w-0 ${mergeState ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <span className="text-blue shrink-0">●</span>
            <span className="text-text truncate">{currentBranch || t('noBranch')}</span>
            <span className="text-subtext text-xs shrink-0">▼</span>
          </button>
          {branchOpen && <BranchDropdown onClose={() => setBranchOpen(false)} />}
        </DragRegion>
        <DragRegion draggable={false} ref={profileRef} className="relative shrink-0">
          <button
            onClick={() => setProfileOpen(o => !o)}
            title={
              activeProfile
                ? tSettings('currentIdentity', { name: identity?.name, email: identity?.email })
                : tSettings('noProfile')
            }
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-surface0 hover:bg-surface1 text-xs transition-colors max-w-40"
          >
            <ProfileIcon size={14} aria-hidden="true" className="shrink-0" />
            <span className={`truncate ${activeProfile ? 'text-text' : 'text-subtext'}`}>
              {activeProfile?.label ?? tSettings('noProfile')}
            </span>
            <span className="text-subtext shrink-0">▼</span>
          </button>
          {profileOpen && <ProfileDropdown onClose={() => setProfileOpen(false)} />}
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
          <span className="text-text truncate max-w-32">{repoName}</span>
          <span className="text-subtext text-xs">▼</span>
        </button>
        {repoOpen && <RepoDropdown onClose={() => setRepoOpen(false)} />}
      </DragRegion>

      {!isMac && <div className="w-36 shrink-0" />}
    </DragRegion>
  );
}
