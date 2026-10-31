import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { gitApi } from '../../api/git-api';
import { useBusy } from '../../hooks/use-busy';
import { errorMessage } from '../../lib/error-message';
import { useGitAction } from '../../hooks/use-git-action';
import { parseConflicts, rebuild, type Choice, type Segment } from '../../lib/merge-conflicts';
import { getLocalStorage } from '../../lib/storage';

export function useMergeEditor() {
  const { t } = useTranslation('merge');
  const { mergeState, abortMerge, refresh, clearMergeState, concludeMerge } = useRepoStore(
    useShallow(s => ({
      mergeState: s.mergeState,
      abortMerge: s.abortMerge,
      refresh: s.refresh,
      clearMergeState: s.clearMergeState,
      concludeMerge: s.concludeMerge,
    })),
  );
  const { activeMergeFile, setActiveMergeFile, setActiveView, addToast, confirmDanger } =
    useUiStore(
      useShallow(s => ({
        activeMergeFile: s.activeMergeFile,
        setActiveMergeFile: s.setActiveMergeFile,
        setActiveView: s.setActiveView,
        addToast: s.addToast,
        confirmDanger: s.confirmDanger,
      })),
    );
  const [segsByFile, setSegsByFile] = useState<Record<string, Segment[]>>({});
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [saving, track] = useBusy();
  const runAction = useGitAction();
  const [autoCommit, setAutoCommit] = useState(
    () => getLocalStorage().getItem('merge-auto-commit') !== 'false',
  );

  const toggleAutoCommit = () => {
    const next = !autoCommit;
    setAutoCommit(next);
    getLocalStorage().setItem('merge-auto-commit', String(next));
  };

  useEffect(() => {
    if (!activeMergeFile || segsByFile[activeMergeFile]) return;
    gitApi
      .readFile(activeMergeFile)
      .then(content => setSegsByFile(m => ({ ...m, [activeMergeFile]: parseConflicts(content) })))
      .catch(err =>
        addToast({ variant: 'error', title: t('loadFailed'), message: errorMessage(err) }),
      );
  }, [activeMergeFile, segsByFile, addToast, t]);

  const files = mergeState?.conflictingFiles ?? [];
  const loadedSegs = activeMergeFile ? segsByFile[activeMergeFile] : undefined;
  const segs = loadedSegs ?? [];
  const remaining = segs.filter(s => s.type === 'conflict' && s.choice === null).length;

  const setChoice = (idx: number, choice: Choice) => {
    if (!activeMergeFile) return;
    setSegsByFile(m => ({
      ...m,
      [activeMergeFile]: m[activeMergeFile].map((s, i) =>
        i === idx && s.type === 'conflict' ? { ...s, choice } : s,
      ),
    }));
  };

  const setAll = (choice: Choice) => {
    if (!activeMergeFile) return;
    setSegsByFile(m => ({
      ...m,
      [activeMergeFile]: m[activeMergeFile].map(s =>
        s.type === 'conflict' ? { ...s, choice } : s,
      ),
    }));
  };

  const handleMarkResolved = async () => {
    if (!mergeState || !activeMergeFile || loadedSegs === undefined || remaining > 0 || saving) {
      return;
    }
    const file = activeMergeFile;
    await track(async () => {
      const ok = await runAction(
        async () => {
          await gitApi.writeFile(file, rebuild(segs));
          await gitApi.markResolved(file);
        },
        { title: t('common:error') },
      );
      if (!ok) return;
      const next = new Set(resolved);
      next.add(file);
      setResolved(next);
      const rem = files.filter(f => !next.has(f));
      if (rem.length > 0) {
        setActiveMergeFile(rem[0]);
        return;
      }
      setActiveMergeFile(null);
      if (autoCommit) {
        const concluded = await runAction(() => concludeMerge(), { title: t('common:error') });
        if (!concluded) return;
        setActiveView('changes');
        addToast({
          variant: 'success',
          title: t('mergeComplete'),
          message: t('mergedMessage', {
            source: mergeState.sourceBranch,
            target: mergeState.targetBranch,
          }),
        });
      } else {
        clearMergeState();
        await refresh();
        setActiveView('changes');
        addToast({
          variant: 'info',
          title: t('conflictsResolved'),
          message: t('commitToFinish', {
            source: mergeState.sourceBranch,
            target: mergeState.targetBranch,
          }),
        });
      }
    });
  };

  const handleAbort = async () => {
    if (saving) return;
    if (resolved.size > 0) {
      const ok = await confirmDanger(t('abortMerge'), t('abortConfirm'));
      if (!ok) return;
    }
    await track(async () => {
      const ok = await runAction(() => abortMerge(), { title: t('abortFailed') });
      if (!ok) return;
      setActiveView('changes');
      addToast({ variant: 'info', title: t('mergeAborted'), message: t('mergeAbortedMessage') });
    });
  };

  const saveDisabled = !activeMergeFile || loadedSegs === undefined || remaining > 0 || saving;

  return {
    mergeState,
    files,
    activeMergeFile,
    setActiveMergeFile,
    resolved,
    segs,
    remaining,
    saving,
    saveDisabled,
    autoCommit,
    toggleAutoCommit,
    setChoice,
    setAll,
    handleMarkResolved,
    handleAbort,
  };
}
