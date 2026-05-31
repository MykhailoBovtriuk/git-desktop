import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { FileList } from '../staging/FileList';
import { StashForm } from './StashForm';

export function StashSection() {
  const { t } = useTranslation('stash');
  const { status, stageFiles, unstageFiles, discardChanges, stashSave } = useRepoStore();
  const { activeView, setActiveView, setSelectedStash, selectedFile, setSelectedFile, addToast } = useUiStore();
  const [loading, setLoading] = useState(false);

  const listMode = activeView === 'stash';
  const canStash = status.staged.length > 0 && !loading;

  const unstagedPaths = status.unstaged.map(f => f.path);
  const stagedPaths = status.staged.map(f => f.path);

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
      await stashSave(message);
      addToast({ variant: 'success', title: t('stashed'), message: t('stashedMessage') });
    } catch (err) {
      addToast({ variant: 'error', title: t('stashFailed'), message: err instanceof Error ? err.message : t('stashFailed') });
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
                <span className="text-subtext text-xs">Unstaged</span>
                <button onClick={() => stageFiles(unstagedPaths)} className="text-green text-xs hover:text-text">
                  Stage All
                </button>
              </div>
              <FileList
                files={status.unstaged}
                staged={false}
                onStage={path => stageFiles([path])}
                onDiscard={path => discardChanges([path])}
                onSelect={setSelectedFile}
                selectedFile={selectedFile}
              />
            </>
          )}
          {status.staged.length > 0 && (
            <>
              <div className="flex items-center justify-between px-3 py-1 mt-1">
                <span className="text-subtext text-xs">Staged</span>
                <button onClick={() => unstageFiles(stagedPaths)} className="text-yellow text-xs hover:text-text">
                  Unstage All
                </button>
              </div>
              <FileList
                files={status.staged}
                staged={true}
                onUnstage={path => unstageFiles([path])}
                onSelect={setSelectedFile}
                selectedFile={selectedFile}
              />
            </>
          )}
          {status.unstaged.length === 0 && status.staged.length === 0 && (
            <p className="text-subtext text-xs text-center py-4">No changes</p>
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
