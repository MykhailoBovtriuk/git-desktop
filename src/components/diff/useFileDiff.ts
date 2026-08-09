import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useUiStore } from '../../stores/ui-store';
import { useRepoStore } from '../../stores/repo-store';
import { gitApi } from '../../api/git-api';
import { useGitAction } from '../../hooks/use-git-action';
import { parseDiff } from './parse-diff';
import { buildHunkPatch } from '../../lib/build-patch';
import type { FileDiff } from '../../types';

// Owns everything about *which* diff to show and fetching it: derives the diff
// source from the current selection, loads the raw diff, parses it, and exposes
// the hunk-staging action. The component stays purely presentational.
export function useFileDiff() {
  const { t } = useTranslation('diff');
  const runGitAction = useGitAction();
  const { stageHunk, unstageHunk } = useRepoStore(
    useShallow(s => ({ stageHunk: s.stageHunk, unstageHunk: s.unstageHunk })),
  );
  // Bumped by every tracked operation; used only as an effect trigger so the
  // open diff re-fetches after a hunk is staged/unstaged (the diff shrinks but
  // no other effect dependency changes).
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
  // The clicked list decides the diff source: a partially staged file is in
  // both lists, so the path alone is ambiguous. Fall back to the status
  // lookup only when a selection carries no area.
  const isStaged = selectedFileArea ? selectedFileArea === 'staged' : stagedInStatus;
  const inChanges = useRepoStore(
    s =>
      !!selectedFile &&
      (s.status.staged.some(f => f.path === selectedFile) ||
        s.status.unstaged.some(f => f.path === selectedFile)),
  );
  const useCommitContext = (activeView === 'history' || activeView === 'graph') && !!selectedCommit;
  // A selection is only valid while viewing a commit, or while the file is still
  // among the current changes. Otherwise (e.g. after commit/discard) show empty.
  const hasSelection = !!selectedFile && (useCommitContext || inChanges);
  const [diffs, setDiffs] = useState<FileDiff[]>([]);
  // Raw diff text kept alongside the parsed hunks so hunk staging can slice an
  // exact patch (parse-diff is lossy — see build-patch.ts).
  const [raw, setRaw] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hunk staging is only meaningful for working/staged changes, never when
  // viewing a historical commit.
  const showHunkActions = inChanges && !useCommitContext;

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
          rawText = await gitApi.getFileDiff(selectedCommit, selectedFile);
        } else {
          rawText = isStaged
            ? await gitApi.getStagedDiff(selectedFile)
            : await gitApi.getWorkingDiff(selectedFile);
        }
        if (!cancelled) {
          setRaw(rawText);
          setDiffs(parseDiff(rawText));
        }
      } catch (err) {
        if (!cancelled) {
          setDiffs([]);
          setRaw('');
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // `epoch` re-runs the fetch after a hunk stage/unstage so the diff stays current.
  }, [selectedFile, selectedCommit, isStaged, useCommitContext, hasSelection, epoch]);

  return { selectedFile, diffs, loading, error, hasSelection, isStaged, showHunkActions, handleHunk };
}
