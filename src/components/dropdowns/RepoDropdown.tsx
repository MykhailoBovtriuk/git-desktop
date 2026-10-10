import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { useGitAction } from '../../hooks/use-git-action';
import { DropdownItem, DropdownPanel } from '../../shared/ui';
import { basenameFromPath } from '../../lib/basename';
import { RepoItem } from './RepoItem';

interface RepoDropdownProps {
  onClose: () => void;
}

export function RepoDropdown({ onClose }: RepoDropdownProps) {
  const { t } = useTranslation('repo');
  const { repoPath, recentRepos, openRepo, openDialog, removeRecentRepo } = useRepoStore(
    useShallow(s => ({
      repoPath: s.repoPath,
      recentRepos: s.recentRepos,
      openRepo: s.openRepo,
      openDialog: s.openDialog,
      removeRecentRepo: s.removeRecentRepo,
    })),
  );
  const requestConfirm = useUiStore(s => s.requestConfirm);
  const runAction = useGitAction();
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const repos = recentRepos.filter(Boolean);

  const handleOpen = async (path: string) => {
    onClose();
    await runAction(() => openRepo(path), { title: t('addRepository') });
  };

  const handleAdd = async () => {
    onClose();
    await runAction(() => openDialog(), { title: t('addRepository') });
  };

  // Removing deletes the repository's logs, and the open one is closed too.
  const handleRemove = async (path: string) => {
    const current = path === repoPath;
    const ok = await requestConfirm({
      title: t(current ? 'removeCurrentTitle' : 'removeTitle'),
      message: t(current ? 'removeCurrentMessage' : 'removeMessage', {
        name: basenameFromPath(path),
      }),
      confirmLabel: t('removeFromList'),
      danger: true,
    });
    if (!ok) return;
    setOpenMenu(null);
    onClose();
    removeRecentRepo(path);
  };

  return (
    <DropdownPanel align="right" width="w-56" className="p-2">
      {repos.map(repo => (
        <RepoItem
          key={repo}
          name={basenameFromPath(repo)}
          current={repo === repoPath}
          contextOpen={openMenu === repo}
          onToggleContext={() => setOpenMenu(prev => (prev === repo ? null : repo))}
          onOpen={() => handleOpen(repo)}
          onRemove={() => handleRemove(repo)}
        />
      ))}

      {repos.length > 0 && <div className="border-t border-surface1 my-1" />}

      <DropdownItem tone="accent" onClick={handleAdd}>
        {t('addRepository')}
      </DropdownItem>
    </DropdownPanel>
  );
}
