import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { gitApi } from '../../api/git-api';
import { parseDiff } from '../diff/parse-diff';
import { StashList } from './StashList';
import { RawDiff } from './RawDiff';
import type { FileDiff } from '../../types';

function extractFileDiff(raw: string, filePath: string): string {
  const sections = raw.split(/^(?=diff --git )/m).filter(Boolean);
<<<<<<< Updated upstream
  return sections.find(s => s.includes(`/${filePath}`)) ?? '';
=======
  return sections.find(s => s.includes(`/${filePath}`) ) ?? '';
>>>>>>> Stashed changes
}

export function StashView() {
  const { t } = useTranslation('stash');
<<<<<<< Updated upstream
  const { stashes, stashApply, stashPop, stashDrop } = useRepoStore();
=======
  const { stashes, status, stashSave, stashApply, stashPop, stashDrop } = useRepoStore();
>>>>>>> Stashed changes
  const { selectedStash, setSelectedStash, addToast } = useUiStore();
  const [rawDiff, setRawDiff] = useState('');
  const [files, setFiles] = useState<FileDiff[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

<<<<<<< Updated upstream
=======
  const canSave = status.staged.length > 0 || status.unstaged.length > 0;

>>>>>>> Stashed changes
  useEffect(() => {
    if (selectedStash === null) { setRawDiff(''); setFiles([]); setSelectedFile(null); return; }
    let cancelled = false;
    gitApi.getStashDiff(selectedStash)
      .then(d => {
        if (cancelled) return;
        setRawDiff(d);
        const parsed = parseDiff(d);
        setFiles(parsed);
        setSelectedFile(parsed[0]?.path ?? null);
      })
      .catch(() => { if (!cancelled) { setRawDiff(''); setFiles([]); setSelectedFile(null); } });
    return () => { cancelled = true; };
  }, [selectedStash, stashes.length]);

  const toast = (variant: 'success' | 'error', titleKey: string, msgKey: string, idx?: number) =>
    (err?: unknown) => addToast({
      variant,
      title: t(titleKey),
      message: err instanceof Error ? err.message : t(msgKey, { index: idx ?? 0 }),
    });

  const handleApply = async (i: number) => {
    try {
      await stashApply(i);
      toast('success', 'applied', 'appliedMessage', i)();
    } catch (err) { toast('error', 'applyFailed', 'applyFailed')(err); }
  };

  const handlePop = async (i: number) => {
    try {
      await stashPop(i);
      if (selectedStash === i) setSelectedStash(null);
      toast('success', 'popped', 'poppedMessage', i)();
    } catch (err) { toast('error', 'popFailed', 'popFailed')(err); }
  };

  const handleDrop = async (i: number) => {
    try {
      await stashDrop(i);
      if (selectedStash === i) setSelectedStash(null);
      toast('success', 'dropped', 'droppedMessage', i)();
    } catch (err) { toast('error', 'dropFailed', 'dropFailed')(err); }
  };

<<<<<<< Updated upstream
=======
  const handleSave = async () => {
    try {
      await stashSave();
      toast('success', 'stashed', 'stashedMessage')();
    } catch (err) { toast('error', 'stashFailed', 'stashFailed')(err); }
  };

>>>>>>> Stashed changes
  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-64 border-r border-surface0 flex flex-col shrink-0">
        <StashList
          stashes={stashes}
          selectedIndex={selectedStash}
<<<<<<< Updated upstream
=======
          canSave={canSave}
>>>>>>> Stashed changes
          onSelect={setSelectedStash}
          onApply={handleApply}
          onPop={handlePop}
          onDrop={handleDrop}
<<<<<<< Updated upstream
=======
          onSave={handleSave}
>>>>>>> Stashed changes
        />
      </div>
      <div className="flex-1 flex overflow-hidden">
        {selectedStash !== null && files.length > 0 ? (
          <>
<<<<<<< Updated upstream
=======
            {/* File list */}
>>>>>>> Stashed changes
            <div className="w-48 border-r border-surface0 overflow-y-auto shrink-0">
              {files.map(f => (
                <button
                  key={f.path}
                  onClick={() => setSelectedFile(f.path)}
                  className={`w-full text-left px-3 py-1.5 text-xs border-l-2 transition-colors truncate ${
                    selectedFile === f.path
                      ? 'bg-surface1 border-blue text-text'
                      : 'border-transparent hover:bg-surface0 text-subtext'
                  }`}
                >
                  {f.path.split('/').pop()}
                </button>
              ))}
            </div>
<<<<<<< Updated upstream
=======
            {/* File diff */}
>>>>>>> Stashed changes
            <div className="flex-1 overflow-hidden">
              <RawDiff raw={selectedFile ? extractFileDiff(rawDiff, selectedFile) : ''} />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-subtext text-xs">
              {stashes.length === 0 ? t('noStashesYet') : t('selectStashHint')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
