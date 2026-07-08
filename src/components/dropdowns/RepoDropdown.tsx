import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useRepoStore } from '../../stores/repo-store';
import { useGitAction } from '../../hooks/use-git-action';
import { DropdownPanel } from '../../shared/ui';
import { basenameFromPath } from '../../lib/basename';

interface RepoDropdownProps {
  onClose: () => void;
}

export function RepoDropdown({ onClose }: RepoDropdownProps) {
  const { t } = useTranslation('repo');
  const { repoPath, recentRepos, openRepo, openDialog } = useRepoStore(
    useShallow(s => ({
      repoPath: s.repoPath,
      recentRepos: s.recentRepos,
      openRepo: s.openRepo,
      openDialog: s.openDialog,
    })),
  );
  const runAction = useGitAction();
  const repos = recentRepos.filter(Boolean);

  const handleOpen = async (path: string) => {
    onClose();
    // A recent path may no longer exist — surface the failure instead of
    // leaving the rejection unhandled with zero feedback.
    await runAction(() => openRepo(path), { title: t('addRepository') });
  };

  const handleAdd = async () => {
    onClose();
    await runAction(() => openDialog(), { title: t('addRepository') });
  };

  return (
    <DropdownPanel align="right" width="w-56" className="py-1">
      {repos.map(repo => (
        <button
          key={repo}
          onClick={() => handleOpen(repo)}
          className="flex items-center justify-between w-full px-3 py-1.5 hover:bg-surface1 text-sm text-left"
        >
          <span className="text-text truncate">{basenameFromPath(repo)}</span>
          {repo === repoPath && <span className="text-blue text-xs ml-2">✓</span>}
        </button>
      ))}

      {repos.length > 0 && <div className="border-t border-surface1 my-1" />}

      <button
        onClick={handleAdd}
        className="w-full text-left px-3 py-1.5 text-blue text-sm hover:bg-surface1"
      >
        {t('addRepository')}
      </button>
    </DropdownPanel>
  );
}
