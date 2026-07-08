import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useRepoStore } from '../../stores/repo-store';
import { useGitAction } from '../../hooks/use-git-action';
import { Button, Badge } from '../../shared/ui';

export function WelcomeScreen() {
  const { t } = useTranslation('repo');
  const { openDialog, openRepo, recentRepos } = useRepoStore(
    useShallow(s => ({ openDialog: s.openDialog, openRepo: s.openRepo, recentRepos: s.recentRepos })),
  );
  const runAction = useGitAction();
  const repos = recentRepos.filter(Boolean);

  // A recent repo may have been moved or deleted since it was saved — without
  // the wrapper the click fails silently and the user is left guessing.
  const handleOpen = (path: string) => runAction(() => openRepo(path), { title: t('open') });
  const handleDialog = () => runAction(() => openDialog(), { title: t('open') });

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-base gap-4">
      <h1 className="text-2xl text-text font-bold flex items-center gap-2">
        Git Desktop
        <Badge variant="beta">Beta</Badge>
      </h1>
      <p className="text-subtext text-sm">{t('tagline')}</p>
      <Button variant="primary" onClick={handleDialog} className="px-5 py-2 mt-2 font-medium">
        {t('open')}
      </Button>

      {repos.length > 0 && (
        <div className="mt-6 w-80">
          <p className="text-subtext text-xs uppercase tracking-wide mb-2 px-1">{t('recent')}</p>
          <div className="bg-surface0 rounded-lg overflow-hidden">
            {repos.map(repo => (
              <button
                key={repo}
                onClick={() => handleOpen(repo)}
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
