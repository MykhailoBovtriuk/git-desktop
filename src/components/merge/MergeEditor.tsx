import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { gitApi } from '../../api/git-api';
import { useGitAction } from '../../hooks/use-git-action';
import { parseConflicts, rebuild, type Choice, type Segment } from '../../lib/merge-conflicts';

export function MergeEditor() {
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
  const { activeMergeFile, setActiveMergeFile, setActiveView, addToast } = useUiStore(
    useShallow(s => ({
      activeMergeFile: s.activeMergeFile,
      setActiveMergeFile: s.setActiveMergeFile,
      setActiveView: s.setActiveView,
      addToast: s.addToast,
    })),
  );
  const [segsByFile, setSegsByFile] = useState<Record<string, Segment[]>>({});
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  // Guards Save/Abort against double clicks — a second concludeMerge() or a
  // concurrent abort would corrupt the merge state.
  const [saving, setSaving] = useState(false);
  const runAction = useGitAction();
  // Default ON: when all conflicts are resolved, the merge commit is created
  // automatically. Off => land on Changes and commit it yourself.
  const [autoCommit, setAutoCommit] = useState(() => localStorage.getItem('merge-auto-commit') !== 'false');

  const toggleAutoCommit = () => {
    const next = !autoCommit;
    setAutoCommit(next);
    localStorage.setItem('merge-auto-commit', String(next));
  };

  useEffect(() => {
    if (!activeMergeFile || segsByFile[activeMergeFile]) return;
    gitApi.readFile(activeMergeFile)
      .then(content => setSegsByFile(m => ({ ...m, [activeMergeFile]: parseConflicts(content) })))
      .catch(err => addToast({ variant: 'error', title: t('loadFailed'), message: String(err) }));
  }, [activeMergeFile, segsByFile, addToast]);

  if (!mergeState) return null;

  const files = mergeState.conflictingFiles;
  // undefined until readFile resolves — Save must stay disabled until then,
  // otherwise rebuild([]) would overwrite the file with an empty string.
  const loadedSegs = activeMergeFile ? segsByFile[activeMergeFile] : undefined;
  const segs = loadedSegs ?? [];
  const remaining = segs.filter(s => s.type === 'conflict' && s.choice === null).length;

  const setChoice = (idx: number, choice: Choice) => {
    if (!activeMergeFile) return;
    setSegsByFile(m => ({
      ...m,
      [activeMergeFile]: m[activeMergeFile].map((s, i) =>
        i === idx && s.type === 'conflict' ? { ...s, choice } : s),
    }));
  };

  const setAll = (choice: Choice) => {
    if (!activeMergeFile) return;
    setSegsByFile(m => ({
      ...m,
      [activeMergeFile]: m[activeMergeFile].map(s => (s.type === 'conflict' ? { ...s, choice } : s)),
    }));
  };

  const handleMarkResolved = async () => {
    if (!activeMergeFile || loadedSegs === undefined || remaining > 0 || saving) return;
    const file = activeMergeFile;
    setSaving(true);
    try {
      const ok = await runAction(async () => {
        await gitApi.writeFile(file, rebuild(segs));
        await gitApi.markResolved(file);
      }, { title: t('common:error') });
      if (!ok) return;
      const next = new Set(resolved); next.add(file);
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
        addToast({ variant: 'success', title: t('mergeComplete'), message: t('mergedMessage', { source: mergeState.sourceBranch, target: mergeState.targetBranch }) });
      } else {
        clearMergeState();
        await refresh();
        setActiveView('changes');
        addToast({ variant: 'info', title: t('conflictsResolved'), message: t('commitToFinish', { source: mergeState.sourceBranch, target: mergeState.targetBranch }) });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleAbort = async () => {
    if (saving) return;
    // Aborting throws away every resolution already staged — confirm once the
    // user has invested work in this merge.
    if (resolved.size > 0 && !window.confirm(t('abortConfirm'))) return;
    setSaving(true);
    try {
      const ok = await runAction(() => abortMerge(), { title: t('abortFailed') });
      if (!ok) return;
      setActiveView('changes');
      addToast({ variant: 'info', title: t('mergeAborted'), message: t('mergeAbortedMessage') });
    } finally {
      setSaving(false);
    }
  };

  const colHead = 'flex-1 flex items-center justify-between px-3 py-1';
  const gutter = 'w-9 shrink-0 flex items-center justify-center border-x border-surface0';

  return (
    <div className="h-full flex flex-col">
      {/* File tabs */}
      <div className="flex items-center bg-mantle border-b border-surface0 shrink-0 overflow-x-auto">
        {files.map(f => (
          <button
            key={f}
            onClick={() => setActiveMergeFile(f)}
            className={`px-3 py-2 text-xs shrink-0 border-r border-surface0 transition-colors ${
              activeMergeFile === f ? 'bg-surface0 text-text' : 'text-subtext hover:bg-surface0'
            } ${resolved.has(f) ? 'text-green' : ''}`}
          >
            {f.split('/').pop()}{resolved.has(f) && ' ✓'}
          </button>
        ))}
        <div className="ml-auto px-3 text-subtext text-xs shrink-0">
          {t('resolved', { resolved: resolved.size, total: files.length })}
        </div>
      </div>

      {/* Column headers */}
      <div className="flex bg-mantle border-b border-surface0 text-xs shrink-0">
        <div className={`${colHead} text-blue`}>
          <span>{t('currentBranch', { branch: mergeState.targetBranch })}</span>
          <button onClick={() => setAll('ours')} className="underline text-subtext hover:text-text">{t('useThis')}</button>
        </div>
        <div className="w-9 shrink-0" />
        <div className={`${colHead} text-text`}>
          <span>{t('resultUpper')}</span>
          <div className="flex gap-3">
            <button onClick={() => setAll('both')} className="underline text-subtext hover:text-text">{t('both')}</button>
            <button onClick={() => setAll(null)} className="underline text-subtext hover:text-text">{t('reset')}</button>
          </div>
        </div>
        <div className="w-9 shrink-0" />
        <div className={`${colHead} text-green`}>
          <span>{t('incomingBranch', { branch: mergeState.sourceBranch })}</span>
          <button onClick={() => setAll('theirs')} className="underline text-subtext hover:text-text">{t('useThis')}</button>
        </div>
      </div>

      {/* Body — single scroll container so the three columns stay aligned */}
      <div className="flex-1 overflow-auto bg-base font-mono text-xs">
        {segs.map((s, idx) =>
          s.type === 'common' ? (
            <div key={idx} className="flex">
              <pre className="flex-1 px-3 py-0.5 text-subtext whitespace-pre-wrap">{s.lines.join('\n')}</pre>
              <div className="w-9 shrink-0" />
              <pre className="flex-1 px-3 py-0.5 text-text whitespace-pre-wrap border-x border-surface0">{s.lines.join('\n')}</pre>
              <div className="w-9 shrink-0" />
              <pre className="flex-1 px-3 py-0.5 text-subtext whitespace-pre-wrap">{s.lines.join('\n')}</pre>
            </div>
          ) : (
            <div key={idx} className="flex items-stretch border-y border-surface0">
              <pre className={`flex-1 px-3 py-1 whitespace-pre-wrap text-text ${s.choice === 'ours' || s.choice === 'both' ? 'bg-green/10' : 'bg-red/10'}`}>{s.ours.join('\n')}</pre>
              <button
                onClick={() => setChoice(idx, 'ours')}
                title={t('useCurrentBlock')}
                className={`${gutter} hover:bg-surface1 transition-colors ${s.choice === 'ours' ? 'text-blue bg-surface0' : 'text-subtext hover:text-text'}`}
              >»</button>
              <div className={`flex-1 px-3 py-1 whitespace-pre-wrap ${s.choice ? 'bg-green/10 text-text' : 'bg-red/15'}`}>
                {s.choice ? (
                  <pre className="whitespace-pre-wrap">{(s.choice === 'ours' ? s.ours : s.choice === 'theirs' ? s.theirs : [...s.ours, ...s.theirs]).join('\n')}</pre>
                ) : (
                  <span className="text-red">{t('unresolvedHint')}</span>
                )}
              </div>
              <button
                onClick={() => setChoice(idx, 'theirs')}
                title={t('useIncomingBlock')}
                className={`${gutter} hover:bg-surface1 transition-colors ${s.choice === 'theirs' ? 'text-green bg-surface0' : 'text-subtext hover:text-text'}`}
              >«</button>
              <pre className={`flex-1 px-3 py-1 whitespace-pre-wrap text-text ${s.choice === 'theirs' || s.choice === 'both' ? 'bg-green/10' : 'bg-red/10'}`}>{s.theirs.join('\n')}</pre>
            </div>
          )
        )}
      </div>

      {/* Footer */}
      <div className="h-10 bg-mantle border-t border-surface0 flex items-center justify-between px-3 shrink-0">
        <span className="text-subtext text-xs">
          {t('mergingArrow', { source: mergeState.sourceBranch, target: mergeState.targetBranch })}
          {remaining > 0 && <span className="text-red"> {t('remainingConflicts', { count: remaining })}</span>}
        </span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleAutoCommit}
            title={t('autoCommitHint')}
            className="flex items-center gap-1.5 text-xs text-subtext hover:text-text transition-colors"
          >
            <span className={`relative inline-flex h-3.5 w-6 items-center rounded-full transition-colors ${autoCommit ? 'bg-blue' : 'bg-surface2'}`}>
              <span className={`inline-block h-2.5 w-2.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${autoCommit ? 'translate-x-3' : 'translate-x-0.5'}`} />
            </span>
            {t('autoCommit')}
          </button>
          <button
            onClick={handleAbort}
            disabled={saving}
            className="px-3 py-1 text-xs text-red hover:bg-surface0 rounded transition-colors disabled:opacity-40"
          >
            {t('abortMerge')}
          </button>
          <button
            onClick={handleMarkResolved}
            disabled={!activeMergeFile || loadedSegs === undefined || remaining > 0 || saving}
            className="px-3 py-1 text-xs bg-blue text-mantle rounded hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {t('saveMarkResolved')}
          </button>
        </div>
      </div>
    </div>
  );
}
