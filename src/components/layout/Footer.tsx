import { useState } from 'react';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';

export function Footer() {
  const { currentBranch, commits, aheadBehind, fetch, pull, push } = useRepoStore();
  const { addToast } = useUiStore();
  const [loading, setLoading] = useState<'fetch' | 'pull' | 'push' | null>(null);

  const run = async (op: 'fetch' | 'pull' | 'push', action: () => Promise<unknown>) => {
    setLoading(op);
    try {
      const result = await action();
      const msg = op === 'pull' && typeof result === 'string' ? result : `${op} successful`;
      addToast({ variant: 'success', title: op.charAt(0).toUpperCase() + op.slice(1), message: msg });
    } catch (err: unknown) {
      addToast({ variant: 'error', title: `${op} failed`, message: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(null);
    }
  };

  const hash = commits[0]?.abbreviatedHash ?? '—';

  return (
    <div className="h-10 bg-mantle border-t border-surface0 flex items-center justify-between px-3 shrink-0 select-none">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-blue">●</span>
        <span className="text-subtext font-mono">{hash}</span>
        <span className="text-text">{currentBranch}</span>
      </div>

      <div className="flex items-center gap-3 text-xs text-subtext">
        {aheadBehind.ahead > 0 && <span className="text-blue">↑{aheadBehind.ahead}</span>}
        {aheadBehind.behind > 0 && <span>↓{aheadBehind.behind}</span>}
      </div>

      <div className="flex items-center gap-1">
        {(['fetch', 'pull', 'push'] as const).map(op => (
          <button
            key={op}
            disabled={!!loading}
            onClick={() => run(op, op === 'fetch' ? fetch : op === 'pull' ? pull : push)}
            className="px-2 py-1 rounded bg-surface0 hover:bg-surface1 text-xs text-text disabled:opacity-50 transition-colors capitalize"
          >
            {loading === op ? '...' : op.charAt(0).toUpperCase() + op.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}
