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
  return sections.find(s => s.includes(`/${filePath}`)) ?? '';
}

export function StashView() {
  const { t } = useTranslation('stash');
  const { stashes, stashApply, stashPop, stashDrop } = useRepoStore();
  const { selectedStash, setSelectedStash, addToast } = useUiStore();
  const [rawDiff, setRawDiff] = useState('');
  const [files, setFiles] = useState<FileDiff[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

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

  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-64 border-r border-surface0 flex flex-col shrink-0">
        <StashList
          stashes={stashes}
          selectedIndex={selectedStash}
          onSelect={setSelectedStash}
          onApply={handleApply}
          onPop={handlePop}
          onDrop={handleDrop}
        />
      </div>
      <div className="flex-1 flex overflow-hidden">
        {selectedStash !== null && files.length > 0 ? (
          <>
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
