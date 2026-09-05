import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { useGitAction } from '../../hooks/use-git-action';
import { WorkingTreeFiles } from '../staging/WorkingTreeFiles';
import { StashForm } from './StashForm';

export function StashSection() {
  const { t } = useTranslation('stash');
  const status = useRepoStore(s => s.status);
  const stashSave = useRepoStore(s => s.stashSave);
  const { activeView, setActiveView, setSelectedStash, addToast } = useUiStore(
    useShallow(s => ({
      activeView: s.activeView,
      setActiveView: s.setActiveView,
      setSelectedStash: s.setSelectedStash,
      addToast: s.addToast,
    })),
  );
  const [loading, setLoading] = useState(false);
  const runAction = useGitAction();

  const listMode = activeView === 'stash';
  const canStash = status.staged.length > 0 && !loading;

  const handleToggle = () => {
    if (listMode) {
      setActiveView('stash-create');
    } else {
      setActiveView('stash');
      setSelectedStash(null);
    }
  };

  const handleStash = async (message: string) => {
    setLoading(true);
    try {
      const ok = await runAction(() => stashSave(message, true), { title: t('stashFailed') });
      if (ok) addToast({ variant: 'success', title: t('stashed'), message: t('stashedMessage') });
    } finally {
      setLoading(false);
    }
  };

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
