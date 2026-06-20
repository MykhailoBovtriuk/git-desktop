import { useTranslation } from 'react-i18next';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { FileList } from './FileList';
import { CommitForm } from './CommitForm';

export function ChangesSection() {
  const { t } = useTranslation('staging');
  const { status, stageFiles, unstageFiles, discardChanges } = useRepoStore();
  const { selectedFile, setSelectedFile } = useUiStore();

  const unstagedPaths = status.unstaged.map(f => f.path);
  const stagedPaths = status.staged.map(f => f.path);

  const handleDiscard = (path: string) => {
    const file = status.unstaged.find(f => f.path === path);
    const isUntracked = file?.status === 'N';
    const message = isUntracked
      ? t('discardUntrackedConfirm', { name: path })
      : t('discardConfirm', { name: path });
    if (window.confirm(message)) discardChanges([path]);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable file lists */}
      <div className="flex-1 overflow-y-auto min-h-0 py-1">
        {status.unstaged.length > 0 && (
          <>
            <div className="flex items-center justify-between px-3 py-1">
              <span className="text-subtext text-xs">Unstaged</span>
              <button
                onClick={() => stageFiles(unstagedPaths)}
                className="text-green text-xs hover:text-text"
              >
                Stage All
              </button>
            </div>
            <FileList
              files={status.unstaged}
              staged={false}
              onStage={path => stageFiles([path])}
              onDiscard={handleDiscard}
              onSelect={setSelectedFile}
              selectedFile={selectedFile}
            />
          </>
        )}

        {status.staged.length > 0 && (
          <>
            <div className="flex items-center justify-between px-3 py-1 mt-1">
              <span className="text-subtext text-xs">Staged</span>
              <button
                onClick={() => unstageFiles(stagedPaths)}
                className="text-yellow text-xs hover:text-text"
              >
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

      {/* CommitForm — always visible at the bottom */}
      <CommitForm />
    </div>
  );
}
