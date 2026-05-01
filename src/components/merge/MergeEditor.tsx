import { useState, useEffect } from 'react';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { gitApi } from '../../api/git-api';

export function MergeEditor() {
  const { mergeState, abortMerge, refresh } = useRepoStore();
  const { activeMergeFile, setActiveMergeFile, setActiveView, addToast } = useUiStore();
  const [results, setResults] = useState<Record<string, string>>({});
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [rawDiff, setRawDiff] = useState('');

  useEffect(() => {
    if (!activeMergeFile) return;
    gitApi.getWorkingDiff(activeMergeFile).then(setRawDiff).catch(() => setRawDiff(''));
  }, [activeMergeFile]);

  if (!mergeState) return null;

  const files = mergeState.conflictingFiles;
  const currentResult = activeMergeFile ? (results[activeMergeFile] ?? rawDiff) : '';

  const handleMarkResolved = async () => {
    if (!activeMergeFile) return;
    try {
      await gitApi.markResolved(activeMergeFile);
      const next = new Set(resolved);
      next.add(activeMergeFile);
      setResolved(next);

      const remaining = files.filter(f => !next.has(f));
      if (remaining.length > 0) {
        setActiveMergeFile(remaining[0]);
      } else {
        // All resolved — complete merge
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

  return (
    <div className="h-full flex flex-col">
      {/* File tabs */}
      <div className="flex items-center bg-mantle border-b border-surface0 shrink-0 overflow-x-auto">
        {files.map(f => (
          <button
            key={f}
            onClick={() => setActiveMergeFile(f)}
            className={`px-3 py-2 text-xs shrink-0 border-r border-surface0 transition-colors ${
              activeMergeFile === f
                ? 'bg-surface0 text-text'
                : 'text-subtext hover:bg-surface0'
            } ${resolved.has(f) ? 'text-green' : ''}`}
          >
            {f.split('/').pop()}
            {resolved.has(f) && ' ✓'}
          </button>
        ))}
        <div className="ml-auto px-3 text-subtext text-xs shrink-0">
          {resolved.size} / {files.length} resolved
        </div>
      </div>

      {/* 3-panel editor */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left — Current (read-only label) */}
        <div className="flex-1 border-r border-surface0 flex flex-col overflow-hidden">
          <div className="bg-mantle px-3 py-1 text-xs text-blue border-b border-surface0 shrink-0">
            CURRENT ({mergeState.targetBranch})
          </div>
          <pre className="flex-1 overflow-auto p-2 text-xs font-mono text-text bg-base whitespace-pre-wrap">
            {rawDiff.split('\n').filter(l => l.startsWith('-') || l.startsWith(' ')).map(l => l.slice(1)).join('\n')}
          </pre>
        </div>

        {/* Center — Result (editable) */}
        <div className="flex-1 border-r border-surface0 flex flex-col overflow-hidden">
          <div className="bg-mantle px-3 py-1 text-xs text-text border-b border-surface0 shrink-0">
            RESULT
          </div>
          <textarea
            value={currentResult}
            onChange={e => {
              if (activeMergeFile) setResults(r => ({ ...r, [activeMergeFile]: e.target.value }));
            }}
            className="flex-1 bg-base text-text font-mono text-xs p-2 resize-none outline-none"
            spellCheck={false}
          />
        </div>

        {/* Right — Incoming (read-only label) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="bg-mantle px-3 py-1 text-xs text-green border-b border-surface0 shrink-0">
            INCOMING ({mergeState.sourceBranch})
          </div>
          <pre className="flex-1 overflow-auto p-2 text-xs font-mono text-text bg-base whitespace-pre-wrap">
            {rawDiff.split('\n').filter(l => l.startsWith('+') || l.startsWith(' ')).map(l => l.slice(1)).join('\n')}
          </pre>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="h-10 bg-mantle border-t border-surface0 flex items-center justify-between px-3 shrink-0">
        <span className="text-subtext text-xs">
          Merging {mergeState.sourceBranch} into {mergeState.targetBranch}
        </span>
        <div className="flex items-center gap-2">
          <button onClick={handleAbort} className="px-3 py-1 text-xs text-red hover:bg-surface0 rounded transition-colors">
            Abort Merge
          </button>
          <button
            onClick={handleMarkResolved}
            disabled={!activeMergeFile}
            className="px-3 py-1 text-xs bg-blue text-base rounded hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            Mark Resolved & Next
          </button>
        </div>
      </div>
    </div>
  );
}
