import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { useGitAction } from '../../hooks/use-git-action';
import { FileList } from './FileList';
import { CommitForm } from './CommitForm';

export function ChangesSection() {
  const { t } = useTranslation('staging');
  const runAction = useGitAction();
  const { status, stageFiles, unstageFiles, discardChanges } = useRepoStore(
    useShallow(s => ({
      status: s.status,
      stageFiles: s.stageFiles,
      unstageFiles: s.unstageFiles,
      discardChanges: s.discardChanges,
    })),
  );
  const { selectedFile, selectedFileArea, setSelectedFile } = useUiStore(
    useShallow(s => ({
      selectedFile: s.selectedFile,
      selectedFileArea: s.selectedFileArea,
      setSelectedFile: s.setSelectedFile,
    })),
  );

  const unstagedPaths = status.unstaged.map(f => f.path);
  const stagedPaths = status.staged.map(f => f.path);

  const stage = (paths: string[]) => runAction(() => stageFiles(paths), { title: t('stage') });
  const unstage = (paths: string[]) => runAction(() => unstageFiles(paths), { title: t('unstage') });

  const handleDiscard = (path: string) => {
    const file = status.unstaged.find(f => f.path === path);
    const isUntracked = file?.status === 'N';
    const message = isUntracked
      ? t('discardUntrackedConfirm', { name: path })
      : t('discardConfirm', { name: path });
    if (window.confirm(message)) {
      void runAction(() => discardChanges([path]), { title: t('discard') });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable file lists */}
      <div className="flex-1 overflow-y-auto min-h-0 py-1">
        {status.unstaged.length > 0 && (
          <>
            <div className="flex items-center justify-between px-3 py-1">
              <span className="text-subtext text-xs">{t('unstaged')}</span>
              <button
                onClick={() => stage(unstagedPaths)}
                className="text-green text-xs hover:text-text"
              >
                {t('stageAll')}
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
              <span className="text-subtext text-xs">{t('staged')}</span>
              <button
                onClick={() => unstage(stagedPaths)}
                className="text-yellow text-xs hover:text-text"
              >
                {t('unstageAll')}
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
          <p className="text-subtext text-xs text-center py-4">{t('noChanges')}</p>
        )}
      </div>

      {/* CommitForm — always visible at the bottom */}
      <CommitForm />
    </div>
  );
}
