import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useUiStore } from '../../stores/ui-store';
import { useRepoStore } from '../../stores/repo-store';
import { useSettingsStore } from '../../stores/settings-store';
import { gitApi } from '../../api/git-api';
import { useGitAction } from '../../hooks/use-git-action';
import { parseDiff } from './parse-diff';
import { buildHunkPatch } from '../../lib/build-patch';
import type { FileDiff } from '../../types';
import { errorMessage } from '../../lib/error-message';

export function useFileDiff() {
  const { t } = useTranslation('diff');
  const runGitAction = useGitAction();
  const { stageHunk, unstageHunk } = useRepoStore(
    useShallow(s => ({ stageHunk: s.stageHunk, unstageHunk: s.unstageHunk })),
  );
  const epoch = useRepoStore(s => s.epoch);
  const { selectedFile, selectedFileArea, selectedCommit, activeView } = useUiStore(
    useShallow(s => ({
      selectedFile: s.selectedFile,
      selectedFileArea: s.selectedFileArea,
      selectedCommit: s.selectedCommit,
      activeView: s.activeView,
    })),
  );
  const stagedInStatus = useRepoStore(
    s => !!selectedFile && s.status.staged.some(f => f.path === selectedFile),
  );
  const isStaged = selectedFileArea ? selectedFileArea === 'staged' : stagedInStatus;
  const inChanges = useRepoStore(
    s =>
      !!selectedFile &&
      (s.status.staged.some(f => f.path === selectedFile) ||
        s.status.unstaged.some(f => f.path === selectedFile)),
  );
  const useCommitContext = (activeView === 'history' || activeView === 'graph') && !!selectedCommit;
  const hasSelection = !!selectedFile && (useCommitContext || inChanges);
  const [diffs, setDiffs] = useState<FileDiff[]>([]);
  const [raw, setRaw] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ignoreWhitespace = useSettingsStore(s => s.diffIgnoreWhitespace);
  // A hunk is staged by applying the diff on screen as a patch; with
  // whitespace left out it no longer matches the file, so staging waits.
  const whitespaceBlocksStaging = inChanges && !useCommitContext && ignoreWhitespace;
  const showHunkActions = inChanges && !useCommitContext && !ignoreWhitespace;

  const handleHunk = (globalHunkIndex: number) =>
    runGitAction(
      async () => {
        const patch = buildHunkPatch(raw, globalHunkIndex);
        await (isStaged ? unstageHunk(patch) : stageHunk(patch));
      },
      { title: isStaged ? t('unstageHunk') : t('stageHunk') },
    );

  useEffect(() => {
    if (!hasSelection) {
      setDiffs([]);
      setRaw('');
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        let rawText = '';
        if (useCommitContext && selectedCommit) {
          rawText = await gitApi.getFileDiff(selectedCommit, selectedFile, ignoreWhitespace);
        } else {
          rawText = isStaged
            ? await gitApi.getStagedDiff(selectedFile, ignoreWhitespace)
            : await gitApi.getWorkingDiff(selectedFile, ignoreWhitespace);
        }
        if (!cancelled) {
          setRaw(rawText);
          setDiffs(parseDiff(rawText));
        }
      } catch (err) {
        if (!cancelled) {
          setDiffs([]);
          setRaw('');
          setError(errorMessage(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    selectedFile,
    selectedCommit,
    isStaged,
    useCommitContext,
    hasSelection,
    epoch,
    ignoreWhitespace,
  ]);

  return {
    selectedFile,
    diffs,
    loading,
    error,
    hasSelection,
    isStaged,
    showHunkActions,
    whitespaceBlocksStaging,
    handleHunk,
  };
}
