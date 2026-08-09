import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { useGitAction } from '../../hooks/use-git-action';
import { FileList } from '../staging/FileList';
import { StashForm } from './StashForm';

export function StashSection() {
  const { t } = useTranslation('stash');
  const { status, stageFiles, unstageFiles, discardChanges, stashSave } = useRepoStore(
    useShallow(s => ({
      status: s.status,
      stageFiles: s.stageFiles,
      unstageFiles: s.unstageFiles,
      discardChanges: s.discardChanges,
      stashSave: s.stashSave,
    })),
  );
  const {
    activeView,
    setActiveView,
    setSelectedStash,
    selectedFile,
    selectedFileArea,
    setSelectedFile,
    addToast,
    requestConfirm,
  } = useUiStore(
    useShallow(s => ({
      activeView: s.activeView,
      setActiveView: s.setActiveView,
      setSelectedStash: s.setSelectedStash,
      selectedFile: s.selectedFile,
      selectedFileArea: s.selectedFileArea,
      setSelectedFile: s.setSelectedFile,
      addToast: s.addToast,
      requestConfirm: s.requestConfirm,
    })),
  );
  const [loading, setLoading] = useState(false);
  const runAction = useGitAction();

  const listMode = activeView === 'stash';
  const canStash = status.staged.length > 0 && !loading;

  const unstagedPaths = status.unstaged.map(f => f.path);
  const stagedPaths = status.staged.map(f => f.path);

  const stage = (paths: string[]) =>
    runAction(() => stageFiles(paths), { title: t('staging:stage') });
  const unstage = (paths: string[]) =>
    runAction(() => unstageFiles(paths), { title: t('staging:unstage') });

  const handleDiscard = async (path: string) => {
    const file = status.unstaged.find(f => f.path === path);
    const isUntracked = file?.status === 'N';
    const message = isUntracked
      ? t('staging:discardUntrackedConfirm', { name: path })
      : t('staging:discardConfirm', { name: path });
    const ok = await requestConfirm({
      title: t('staging:discard'),
      message,
      confirmLabel: t('staging:discard'),
      danger: true,
    });
    if (ok) {
      void runAction(() => discardChanges([path]), { title: t('staging:discard') });
    }
  };

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
      {!listMode && (
        <div className="flex-1 overflow-y-auto min-h-0 py-1">
          {status.unstaged.length > 0 && (
            <>
              <div className="flex items-center justify-between px-3 py-1">
                <span className="text-subtext text-xs">{t('staging:unstaged')}</span>
                <button
                  onClick={() => stage(unstagedPaths)}
                  className="text-green text-xs hover:text-text"
                >
                  {t('staging:stageAll')}
                </button>
              </div>
              <FileList
                files={status.unstaged}
                staged={false}
                onStage={path => stage([path])}
                onDiscard={handleDiscard}
                onSelect={path => setSelectedFile(path, 'unstaged')}
                selectedFile={selectedFileArea === 'unstaged' ? selectedFile : null}
              />
            </>
          )}
          {status.staged.length > 0 && (
            <>
              <div className="flex items-center justify-between px-3 py-1 mt-1">
                <span className="text-subtext text-xs">{t('staging:staged')}</span>
                <button
                  onClick={() => unstage(stagedPaths)}
                  className="text-yellow text-xs hover:text-text"
                >
                  {t('staging:unstageAll')}
                </button>
              </div>
              <FileList
                files={status.staged}
                staged={true}
                onUnstage={path => unstage([path])}
                onSelect={path => setSelectedFile(path, 'staged')}
                selectedFile={selectedFileArea === 'staged' ? selectedFile : null}
              />
            </>
          )}
          {status.unstaged.length === 0 && status.staged.length === 0 && (
            <p className="text-subtext text-xs text-center py-4">{t('staging:noChanges')}</p>
          )}
        </div>
      )}
      <StashForm
        canStash={canStash}
        onStash={handleStash}
        listMode={listMode}
        onToggle={handleToggle}
      />
    </div>
  );
}
