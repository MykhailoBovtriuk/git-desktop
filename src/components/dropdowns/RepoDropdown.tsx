import { useRepoStore } from '../../stores/repo-store';
import { DropdownPanel } from '../../shared/ui';

interface RepoDropdownProps {
  onClose: () => void;
}

export function RepoDropdown({ onClose }: RepoDropdownProps) {
  const { repoPath, recentRepos, openRepo, openDialog } = useRepoStore();

  const handleOpen = async (path: string) => {
    onClose();
    await openRepo(path);
  };

  const handleAdd = async () => {
    onClose();
    await openDialog();
  };

  return (
    <DropdownPanel align="right" width="w-56" className="py-1">
      {recentRepos.map(repo => (
        <button
          key={repo}
          onClick={() => handleOpen(repo)}
          className="flex items-center justify-between w-full px-3 py-1.5 hover:bg-surface1 text-sm text-left"
        >
          <span className="text-text truncate">{repo.split('/').pop()}</span>
          {repo === repoPath && <span className="text-blue text-xs ml-2">✓</span>}
        </button>
      ))}

      {recentRepos.length > 0 && <div className="border-t border-surface1 my-1" />}

      <button
        onClick={handleAdd}
        className="w-full text-left px-3 py-1.5 text-blue text-sm hover:bg-surface1"
      >
        Add Repository...
      </button>
    </DropdownPanel>
  );
}
