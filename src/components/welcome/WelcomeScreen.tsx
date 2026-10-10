import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { useGitAction } from '../../hooks/use-git-action';
import { Button, Badge, InfoIcon, SettingsIcon, TruncatedText } from '../../shared/ui';
import { basenameFromPath } from '../../lib/basename';

export function WelcomeScreen() {
  const { t } = useTranslation('repo');
  const { t: tc } = useTranslation('common');
  const openOverlayView = useUiStore(s => s.openOverlayView);
  const { openDialog, openRepo, recentRepos } = useRepoStore(
    useShallow(s => ({
      openDialog: s.openDialog,
      openRepo: s.openRepo,
      recentRepos: s.recentRepos,
    })),
  );
  const runAction = useGitAction();
  const repos = recentRepos.filter(Boolean);

  const handleOpen = (path: string) => runAction(() => openRepo(path), { title: t('open') });
  const handleDialog = () => runAction(() => openDialog(), { title: t('open') });

  return (
    <div className="relative h-screen flex flex-col items-center justify-center bg-base gap-4">
      <h1 className="text-2xl text-text font-bold flex items-center gap-2">
        Git Desktop
        <Badge variant="beta">Beta</Badge>
      </h1>
      <p className="text-subtext text-sm">{t('tagline')}</p>
      {/* One column as wide as the Settings/Info pair, so the main action
          lines up with them. No titlebar or footer here, so the way to
          Settings and About is part of the page itself. */}
      <div className="inline-flex flex-col gap-2 mt-2">
        <Button
          variant="primary"
          onClick={handleDialog}
          className="px-5 py-2 font-medium"
          fullWidth
        >
          {t('open')}
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="surface"
            onClick={() => openOverlayView('settings')}
            className="px-5 py-2 font-medium flex flex-1 items-center justify-center gap-2"
          >
            <SettingsIcon size={16} aria-hidden="true" />
            {tc('settings')}
          </Button>
          <Button
            variant="surface"
            onClick={() => openOverlayView('about')}
            className="px-5 py-2 font-medium flex flex-1 items-center justify-center gap-2"
          >
            <InfoIcon size={16} aria-hidden="true" />
            {tc('info')}
          </Button>
        </div>
      </div>

      {repos.length > 0 && (
        <div className="mt-6 w-80">
          <p className="text-subtext text-xs uppercase tracking-wide mb-2 px-1">{t('recent')}</p>
          <div className="bg-surface0 rounded-lg overflow-hidden">
            {repos.map(repo => (
              <button
                key={repo}
                onClick={() => handleOpen(repo)}
                className="w-full text-left px-3 py-2 hover:bg-surface1 transition-colors border-b border-surface0 last:border-0 min-w-0"
              >
                <TruncatedText className="block text-sm text-text">
                  {basenameFromPath(repo)}
                </TruncatedText>
                <TruncatedText className="block text-xs text-subtext">{repo}</TruncatedText>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
