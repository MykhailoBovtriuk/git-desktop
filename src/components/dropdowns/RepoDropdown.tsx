import { useRepoStore } from '../../stores/repo-store';

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
    <div className="absolute top-full right-0 mt-1 bg-surface0 rounded-lg shadow-xl z-50 w-56 py-1">
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
    </div>
  );
}
