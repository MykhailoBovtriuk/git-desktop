import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { classifyGitError } from '../../lib/git-error-mapper';
import { Button } from '../../shared/ui';

export function Footer() {
  const { t } = useTranslation('footer');
  const { currentBranch, commits, aheadBehind, fetch, pull, push, publishBranch } = useRepoStore();
  const { addToast } = useUiStore();
  const [loading, setLoading] = useState<'fetch' | 'pull' | 'push' | null>(null);

  const handlePublish = () => {
    void publishBranch()
      .then(() => addToast({ variant: 'success', title: t('publishBranch'), message: t('success', { op: t('push') }) }))
      .catch(e => addToast({ variant: 'error', title: t('publishBranch'), message: e instanceof Error ? e.message : String(e) }));
  };

  const run = async (op: 'fetch' | 'pull' | 'push', action: () => Promise<unknown>) => {
    setLoading(op);
    const label = t(op);
    try {
      const result = await action();
      const msg = op === 'pull' && typeof result === 'string' ? result : t('success', { op: label });
      addToast({ variant: 'success', title: label, message: msg });
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : String(err);
      // Map raw git stderr to a friendly explanation; fall back to the raw text
      // for unrecognized errors. A missing upstream offers a Publish action.
      const { kind, action: errAction } = classifyGitError(err);
      const friendly = t(`error.${kind}`);
      addToast({
        variant: 'error',
        title: t('failed', { op: label }),
        message: friendly || raw,
        action:
          errAction === 'publishBranch' && currentBranch
            ? { label: t('publishBranch'), onClick: handlePublish }
            : undefined,
      });
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
          <Button
            key={op}
            variant="surface"
            size="sm"
            disabled={!!loading}
            onClick={() => run(op, op === 'fetch' ? fetch : op === 'pull' ? pull : push)}
            className="capitalize"
          >
            {loading === op ? '...' : t(op)}
          </Button>
        ))}
      </div>
    </div>
  );
}
