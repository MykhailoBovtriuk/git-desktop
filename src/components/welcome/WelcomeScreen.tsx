import { useRepoStore } from '../../stores/repo-store';
import { Button, Badge } from '../../shared/ui';

export function WelcomeScreen() {
  const { openDialog, openRepo, recentRepos } = useRepoStore();

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-base gap-4">
      <h1 className="text-2xl text-text font-bold flex items-center gap-2">
        Git Desktop
        <Badge variant="beta">Beta</Badge>
      </h1>
      <p className="text-subtext text-sm">Open a repository to get started</p>
      <Button variant="primary" onClick={openDialog} className="px-5 py-2 mt-2 font-medium">
        Open Repository
      </Button>

      {recentRepos.length > 0 && (
        <div className="mt-6 w-80">
          <p className="text-subtext text-xs uppercase tracking-wide mb-2 px-1">Recent</p>
          <div className="bg-surface0 rounded-lg overflow-hidden">
            {recentRepos.map(repo => (
              <button
                key={repo}
                onClick={() => openRepo(repo)}
                className="w-full text-left px-3 py-2 text-sm text-text hover:bg-surface1 transition-colors border-b border-surface0 last:border-0 truncate"
              >
                {repo}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
