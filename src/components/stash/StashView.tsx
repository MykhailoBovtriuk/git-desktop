import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { useGitAction } from '../../hooks/use-git-action';
import { gitApi } from '../../api/git-api';
import { parseDiff } from '../diff/parse-diff';
import { StashList } from './StashList';
import { RawDiff } from './RawDiff';
import { FilePathList, ResizeHandle } from '../../shared/ui';
import { useResizableWidth } from '../../hooks/use-resizable-width';
import type { FileDiff, StashEntry } from '../../types';

function extractFileDiff(raw: string, filePath: string): string {
  const sections = raw.split(/^(?=diff --git )/m).filter(Boolean);
  return sections.find(s => s.includes(`/${filePath}`)) ?? '';
}

export function StashView() {
  const { t } = useTranslation('stash');
  const { stashes, stashApply, stashPop, stashDrop } = useRepoStore(
    useShallow(s => ({
      stashes: s.stashes,
      stashApply: s.stashApply,
      stashPop: s.stashPop,
      stashDrop: s.stashDrop,
    })),
  );
  const { selectedStash, setSelectedStash } = useUiStore(
    useShallow(s => ({
      selectedStash: s.selectedStash,
      setSelectedStash: s.setSelectedStash,
    })),
  );
  const [rawDiff, setRawDiff] = useState('');
  const [files, setFiles] = useState<FileDiff[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const stashesColumn = useResizableWidth('stash-list-width', 224, 560, 256);
  const filesColumn = useResizableWidth('stash-files-width', 160, 480, 192);

  // Stash indices shift on drop/save, so remember which stash was selected
  // (message+date) and remap or clear the index.
  const stashIdentity = (s: StashEntry) => `${s.message}\u0000${s.date}`;
  const selectedIdentityRef = useRef<string | null>(null);
  const prevStashesRef = useRef(stashes);

  useEffect(() => {
    const listChanged = prevStashesRef.current !== stashes;
    prevStashesRef.current = stashes;

    if (selectedStash === null) {
      selectedIdentityRef.current = null;
      return;
    }
    const entry = stashes[selectedStash];
    if (!listChanged) {
      selectedIdentityRef.current = entry ? stashIdentity(entry) : null;
      return;
    }
    if (entry && stashIdentity(entry) === selectedIdentityRef.current) return;
    const remapped = stashes.findIndex(s => stashIdentity(s) === selectedIdentityRef.current);
    if (remapped === -1) {
      selectedIdentityRef.current = null;
      setSelectedStash(null);
    } else {
      setSelectedStash(remapped);
    }
  }, [stashes, selectedStash, setSelectedStash]);

  useEffect(() => {
    if (selectedStash === null) {
      setRawDiff('');
      setFiles([]);
      setSelectedFile(null);
      return;
    }
    let cancelled = false;
    gitApi
      .getStashDiff(selectedStash)
      .then(d => {
        if (cancelled) return;
        setRawDiff(d);
        const parsed = parseDiff(d);
        setFiles(parsed);
        setSelectedFile(parsed[0]?.path ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setRawDiff('');
          setFiles([]);
          setSelectedFile(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedStash, stashes.length]);

  const runAction = useGitAction();
  const stashAction = async (
    action: (i: number) => Promise<void>,
    i: number,
    keys: { failed: string; done: string; message: string },
    deselect = false,
  ) => {
    const ok = await runAction(() => action(i), {
      title: t(keys.failed),
      successTitle: t(keys.done),
      success: t(keys.message, { index: i }),
    });
    if (ok && deselect && selectedStash === i) setSelectedStash(null);
  };

  const handleApply = (i: number) =>
    stashAction(stashApply, i, {
      failed: 'applyFailed',
      done: 'applied',
      message: 'appliedMessage',
    });
  const handlePop = (i: number) =>
    stashAction(
      stashPop,
      i,
      { failed: 'popFailed', done: 'popped', message: 'poppedMessage' },
      true,
    );
  const handleDrop = (i: number) =>
    stashAction(
      stashDrop,
      i,
      { failed: 'dropFailed', done: 'dropped', message: 'droppedMessage' },
      true,
    );

  return (
    <div className="flex h-full overflow-hidden">
      <div
        className="border-r border-surface0 flex flex-col shrink-0"
        style={{ width: stashesColumn.width }}
      >
        <StashList
          stashes={stashes}
          selectedIndex={selectedStash}
          onSelect={setSelectedStash}
          onApply={handleApply}
          onPop={handlePop}
          onDrop={handleDrop}
        />
      </div>
      <ResizeHandle label={t('common:resizeStashList')} onMouseDown={stashesColumn.startResize} />
      <div className="flex-1 flex overflow-hidden">
        {selectedStash !== null && files.length > 0 ? (
          <>
            <FilePathList
              files={files}
              selected={selectedFile}
              onSelect={setSelectedFile}
              width={filesColumn.width}
            />
            <ResizeHandle
              label={t('common:resizeFileList')}
              onMouseDown={filesColumn.startResize}
            />
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
