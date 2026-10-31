import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { useGitAction } from '../../hooks/use-git-action';
import { useBusy } from '../../hooks/use-busy';
import { WorkingTreeFiles } from '../staging/WorkingTreeFiles';
import { StashForm } from './StashForm';

export function StashSection() {
  const { t } = useTranslation('stash');
  const status = useRepoStore(s => s.status);
  const stashSave = useRepoStore(s => s.stashSave);
  const { activeView, setActiveView, setSelectedStash } = useUiStore(
    useShallow(s => ({
      activeView: s.activeView,
      setActiveView: s.setActiveView,
      setSelectedStash: s.setSelectedStash,
    })),
  );
  const [loading, track] = useBusy();
  const runAction = useGitAction();

  const listMode = activeView === 'stash';
  const canStash = status.staged.length > 0 && !loading;

  const handleToggle = () => {
    setActiveView('stash');
    setSelectedStash(null);
  };

  const handleStash = (message: string) =>
    track(() =>
      runAction(() => stashSave(message, true), {
        title: t('stashFailed'),
        successTitle: t('stashed'),
        success: t('stashedMessage'),
      }),
    );

  return (
    <div className="flex flex-col h-full">
      {!listMode && <WorkingTreeFiles />}
      <StashForm
        canStash={canStash}
        onStash={handleStash}
        listMode={listMode}
        onToggle={handleToggle}
      />
    </div>
  );
}
