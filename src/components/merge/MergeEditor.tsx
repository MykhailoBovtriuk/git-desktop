import { useState, useEffect } from 'react';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { gitApi } from '../../api/git-api';

type Choice = 'ours' | 'theirs' | 'both' | null;
type Segment =
  | { type: 'common'; text: string }
  | { type: 'conflict'; ours: string; theirs: string; choice: Choice };

// Split a conflicted file into common text and conflict blocks.
function parseConflicts(content: string): Segment[] {
  const lines = content.split('\n');
  const segs: Segment[] = [];
  let common: string[] = [];
  const flush = () => {
    if (common.length) { segs.push({ type: 'common', text: common.join('\n') }); common = []; }
  };

  let i = 0;
  while (i < lines.length) {
    if (lines[i].startsWith('<<<<<<<')) {
      flush();
      i++;
      const ours: string[] = [];
      while (i < lines.length && !lines[i].startsWith('=======') && !lines[i].startsWith('|||||||')) {
        ours.push(lines[i]); i++;
      }
      // Skip the diff3 base section if present (||||||| ... =======).
      if (i < lines.length && lines[i].startsWith('|||||||')) {
        i++;
        while (i < lines.length && !lines[i].startsWith('=======')) i++;
      }
      i++; // skip =======
      const theirs: string[] = [];
      while (i < lines.length && !lines[i].startsWith('>>>>>>>')) { theirs.push(lines[i]); i++; }
      i++; // skip >>>>>>>
      segs.push({ type: 'conflict', ours: ours.join('\n'), theirs: theirs.join('\n'), choice: null });
    } else {
      common.push(lines[i]); i++;
    }
  }
  flush();
  return segs;
}

// Reconstruct file text from segments; unresolved blocks keep their markers.
function rebuild(segs: Segment[]): string {
  return segs.map(s => {
    if (s.type === 'common') return s.text;
    if (s.choice === 'ours') return s.ours;
    if (s.choice === 'theirs') return s.theirs;
    if (s.choice === 'both') return `${s.ours}\n${s.theirs}`;
    return `<<<<<<< HEAD\n${s.ours}\n=======\n${s.theirs}\n>>>>>>>`;
  }).join('\n');
}

export function MergeEditor() {
  const { mergeState, abortMerge, refresh, clearMergeState, concludeMerge } = useRepoStore();
  const { activeMergeFile, setActiveMergeFile, setActiveView, addToast } = useUiStore();
  const [segsByFile, setSegsByFile] = useState<Record<string, Segment[]>>({});
  const [resolved, setResolved] = useState<Set<string>>(new Set());
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
      .catch(err => addToast({ variant: 'error', title: 'Load failed', message: String(err) }));
  }, [activeMergeFile, segsByFile, addToast]);

  if (!mergeState) return null;

  const files = mergeState.conflictingFiles;
  const segs = activeMergeFile ? segsByFile[activeMergeFile] ?? [] : [];
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
    if (!activeMergeFile || remaining > 0) return;
    try {
      await gitApi.writeFile(activeMergeFile, rebuild(segs));
      await gitApi.markResolved(activeMergeFile);
      const next = new Set(resolved); next.add(activeMergeFile);
      setResolved(next);
      const rem = files.filter(f => !next.has(f));
      if (rem.length > 0) {
        setActiveMergeFile(rem[0]);
        return;
      }
      setActiveMergeFile(null);
      if (autoCommit) {
        await concludeMerge();
        setActiveView('changes');
        addToast({ variant: 'success', title: 'Merge complete', message: `Merged ${mergeState.sourceBranch} into ${mergeState.targetBranch}` });
      } else {
        clearMergeState();
        await refresh();
        setActiveView('changes');
        addToast({ variant: 'info', title: 'Conflicts resolved', message: `Commit to finish merging ${mergeState.sourceBranch} → ${mergeState.targetBranch}` });
      }
    } catch (err: unknown) {
      addToast({ variant: 'error', title: 'Error', message: err instanceof Error ? err.message : String(err) });
    }
  };

  const handleAbort = async () => {
    try {
      await abortMerge();
      setActiveView('changes');
      addToast({ variant: 'info', title: 'Merge aborted', message: 'Merge was aborted' });
    } catch (err: unknown) {
      addToast({ variant: 'error', title: 'Abort failed', message: err instanceof Error ? err.message : String(err) });
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
          {resolved.size} / {files.length} resolved
        </div>
      </div>

      {/* Column headers */}
      <div className="flex bg-mantle border-b border-surface0 text-xs shrink-0">
        <div className={`${colHead} text-blue`}>
          <span>CURRENT ({mergeState.targetBranch})</span>
          <button onClick={() => setAll('ours')} className="underline text-subtext hover:text-text">Use this</button>
        </div>
        <div className="w-9 shrink-0" />
        <div className={`${colHead} text-text`}>
          <span>RESULT</span>
          <div className="flex gap-3">
            <button onClick={() => setAll('both')} className="underline text-subtext hover:text-text">both</button>
            <button onClick={() => setAll(null)} className="underline text-subtext hover:text-text">reset</button>
          </div>
        </div>
        <div className="w-9 shrink-0" />
        <div className={`${colHead} text-green`}>
          <span>INCOMING ({mergeState.sourceBranch})</span>
          <button onClick={() => setAll('theirs')} className="underline text-subtext hover:text-text">Use this</button>
        </div>
      </div>

      {/* Body — single scroll container so the three columns stay aligned */}
      <div className="flex-1 overflow-auto bg-base font-mono text-xs">
        {segs.map((s, idx) =>
          s.type === 'common' ? (
            <div key={idx} className="flex">
              <pre className="flex-1 px-3 py-0.5 text-subtext whitespace-pre-wrap">{s.text}</pre>
              <div className="w-9 shrink-0" />
              <pre className="flex-1 px-3 py-0.5 text-text whitespace-pre-wrap border-x border-surface0">{s.text}</pre>
              <div className="w-9 shrink-0" />
              <pre className="flex-1 px-3 py-0.5 text-subtext whitespace-pre-wrap">{s.text}</pre>
            </div>
          ) : (
            <div key={idx} className="flex items-stretch border-y border-surface0">
              <pre className={`flex-1 px-3 py-1 whitespace-pre-wrap text-text ${s.choice === 'ours' || s.choice === 'both' ? 'bg-green/10' : 'bg-red/10'}`}>{s.ours}</pre>
              <button
                onClick={() => setChoice(idx, 'ours')}
                title="Use current for this block"
                className={`${gutter} hover:bg-surface1 transition-colors ${s.choice === 'ours' ? 'text-blue bg-surface0' : 'text-subtext hover:text-text'}`}
              >»</button>
              <div className={`flex-1 px-3 py-1 whitespace-pre-wrap ${s.choice ? 'bg-green/10 text-text' : 'bg-red/15'}`}>
                {s.choice ? (
                  <pre className="whitespace-pre-wrap">{s.choice === 'ours' ? s.ours : s.choice === 'theirs' ? s.theirs : `${s.ours}\n${s.theirs}`}</pre>
                ) : (
                  <span className="text-red">‹ unresolved — pick a side (» / «) ›</span>
                )}
              </div>
              <button
                onClick={() => setChoice(idx, 'theirs')}
                title="Use incoming for this block"
                className={`${gutter} hover:bg-surface1 transition-colors ${s.choice === 'theirs' ? 'text-green bg-surface0' : 'text-subtext hover:text-text'}`}
              >«</button>
              <pre className={`flex-1 px-3 py-1 whitespace-pre-wrap text-text ${s.choice === 'theirs' || s.choice === 'both' ? 'bg-green/10' : 'bg-red/10'}`}>{s.theirs}</pre>
            </div>
          )
        )}
      </div>

      {/* Footer */}
      <div className="h-10 bg-mantle border-t border-surface0 flex items-center justify-between px-3 shrink-0">
        <span className="text-subtext text-xs">
          Merging <span className="text-green">{mergeState.sourceBranch}</span> → <span className="text-blue">{mergeState.targetBranch}</span>
          {remaining > 0 && <span className="text-red"> · {remaining} conflict{remaining !== 1 ? 's' : ''} remaining</span>}
        </span>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleAutoCommit}
            title="When all conflicts are resolved, create the merge commit automatically"
            className="flex items-center gap-1.5 text-xs text-subtext hover:text-text transition-colors"
          >
            <span className={`relative inline-flex h-3.5 w-6 items-center rounded-full transition-colors ${autoCommit ? 'bg-blue' : 'bg-surface2'}`}>
              <span className={`inline-block h-2.5 w-2.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${autoCommit ? 'translate-x-3' : 'translate-x-0.5'}`} />
            </span>
            Auto-commit
          </button>
          <button
            onClick={handleAbort}
            className="px-3 py-1 text-xs text-red hover:bg-surface0 rounded transition-colors"
          >
            Abort Merge
          </button>
          <button
            onClick={handleMarkResolved}
            disabled={!activeMergeFile || remaining > 0}
            className="px-3 py-1 text-xs bg-blue text-mantle rounded hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            Save &amp; Mark Resolved
          </button>
        </div>
      </div>
    </div>
  );
}
