import { useState, useEffect } from 'react';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { gitApi } from '../../api/git-api';

export function MergeEditor() {
  const { mergeState, abortMerge, refresh } = useRepoStore();
  const { activeMergeFile, setActiveMergeFile, setActiveView, addToast } = useUiStore();
  const [results, setResults] = useState<Record<string, string>>({});
  const [sides, setSides] = useState<{ ours: string; theirs: string }>({ ours: '', theirs: '' });
  const [resolved, setResolved] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!activeMergeFile) return;
    Promise.all([
      gitApi.readFile(activeMergeFile),
      gitApi.getConflictSides(activeMergeFile),
    ]).then(([current, s]) => {
      setSides({ ours: s.ours, theirs: s.theirs });
      setResults(r => (activeMergeFile in r ? r : { ...r, [activeMergeFile]: current }));
    }).catch(err => addToast({ variant: 'error', title: 'Load failed', message: String(err) }));
  }, [activeMergeFile, addToast]);

  if (!mergeState) return null;

  const files = mergeState.conflictingFiles;
  const result = activeMergeFile ? results[activeMergeFile] ?? '' : '';

  const handleMarkResolved = async () => {
    if (!activeMergeFile) return;
    try {
      await gitApi.writeFile(activeMergeFile, result);
      await gitApi.markResolved(activeMergeFile);
      const next = new Set(resolved);
      next.add(activeMergeFile);
      setResolved(next);
      const remaining = files.filter(f => !next.has(f));
      if (remaining.length > 0) {
        setActiveMergeFile(remaining[0]);
      } else {
        await refresh();
        setActiveView('changes');
        addToast({ variant: 'success', title: 'Merge complete', message: `Merged ${mergeState.sourceBranch} into ${mergeState.targetBranch}` });
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

  const acceptCurrent = () =>
    activeMergeFile && setResults(r => ({ ...r, [activeMergeFile]: sides.ours }));
  const acceptIncoming = () =>
    activeMergeFile && setResults(r => ({ ...r, [activeMergeFile]: sides.theirs }));

  return (
    <div className="h-full flex flex-col">
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

      <div className="flex flex-1 overflow-hidden">
        <Panel
          label={`CURRENT (${mergeState.targetBranch})`}
          color="text-blue"
          content={sides.ours}
          onAccept={acceptCurrent}
        />
        <Panel
          label="RESULT"
          color="text-text"
          content={result}
          editable
          onChange={v => activeMergeFile && setResults(r => ({ ...r, [activeMergeFile]: v }))}
        />
        <Panel
          label={`INCOMING (${mergeState.sourceBranch})`}
          color="text-green"
          content={sides.theirs}
          onAccept={acceptIncoming}
        />
      </div>

      <div className="h-10 bg-mantle border-t border-surface0 flex items-center justify-between px-3 shrink-0">
        <span className="text-subtext text-xs">
          Merging {mergeState.sourceBranch} → {mergeState.targetBranch}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAbort}
            className="px-3 py-1 text-xs text-red hover:bg-surface0 rounded transition-colors"
          >
            Abort Merge
          </button>
          <button
            onClick={handleMarkResolved}
            disabled={!activeMergeFile}
            className="px-3 py-1 text-xs bg-blue text-mantle rounded hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            Save & Mark Resolved
          </button>
        </div>
      </div>
    </div>
  );
}

function Panel({ label, color, content, editable, onChange, onAccept }: {
  label: string;
  color: string;
  content: string;
  editable?: boolean;
  onChange?: (v: string) => void;
  onAccept?: () => void;
}) {
  return (
    <div className="flex-1 border-r border-surface0 flex flex-col overflow-hidden last:border-0">
      <div className={`flex items-center justify-between bg-mantle px-3 py-1 text-xs ${color} border-b border-surface0 shrink-0`}>
        <span>{label}</span>
        {onAccept && (
          <button onClick={onAccept} className="text-xs underline text-subtext hover:text-text">
            Use this
          </button>
        )}
      </div>
      {editable ? (
        <textarea
          value={content}
          onChange={e => onChange?.(e.target.value)}
          className="flex-1 bg-base text-text font-mono text-xs p-2 resize-none outline-none"
          spellCheck={false}
        />
      ) : (
        <pre className="flex-1 overflow-auto p-2 text-xs font-mono text-text bg-base whitespace-pre-wrap">
          {content}
        </pre>
      )}
    </div>
  );
}
