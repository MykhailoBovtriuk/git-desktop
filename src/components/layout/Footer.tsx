import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { classifyGitError } from '../../lib/git-error-mapper';
import { Button } from '../../shared/ui';
import { AppMenuButtons } from './AppMenuButtons';

export function Footer() {
  const { t } = useTranslation('footer');
  const { currentBranch, commits, aheadBehind, fetch, pull, push, publishBranch } = useRepoStore(
    useShallow(s => ({
      currentBranch: s.currentBranch,
      commits: s.commits,
      aheadBehind: s.aheadBehind,
      fetch: s.fetch,
      pull: s.pull,
      push: s.push,
      publishBranch: s.publishBranch,
    })),
  );
  const { addToast } = useUiStore(useShallow(s => ({ addToast: s.addToast })));
  const [loading, setLoading] = useState<'fetch' | 'pull' | 'push' | null>(null);

  const handlePublish = () => {
    void publishBranch()
      .then(() =>
        addToast({
          variant: 'success',
          title: t('publishBranch'),
          message: t('success', { op: t('push') }),
        }),
      )
      .catch(e =>
        addToast({
          variant: 'error',
          title: t('publishBranch'),
          message: e instanceof Error ? e.message : String(e),
        }),
      );
  };

  const run = async (op: 'fetch' | 'pull' | 'push', action: () => Promise<unknown>) => {
    setLoading(op);
    const label = t(op);
    try {
      const result = await action();
      const msg =
        op === 'pull' && typeof result === 'string' ? result : t('success', { op: label });
      addToast({ variant: 'success', title: label, message: msg });
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : String(err);
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
  const diverged = aheadBehind.ahead > 0 || aheadBehind.behind > 0;

  return (
    <div className="relative h-10 bg-mantle border-t border-surface0 flex items-center justify-between px-3 shrink-0 select-none">
      <div className="shrink-0">
        <AppMenuButtons />
      </div>

      {/* Centred on the window rather than on the leftover space, so the branch
          readout does not drift as the side blocks change width. */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 text-xs max-w-[45%]">
        <span className="text-blue shrink-0">●</span>
        <span className="text-subtext font-mono shrink-0">{hash}</span>
        <span className="text-text truncate">{currentBranch}</span>
        {diverged && (
          <>
            <span className="text-surface2 shrink-0">|</span>
            <span className="flex items-center gap-2 text-subtext shrink-0">
              {aheadBehind.ahead > 0 && (
                <span
                  className="text-blue"
                  title={t('ahead', { count: aheadBehind.ahead })}
                  aria-label={t('ahead', { count: aheadBehind.ahead })}
                >
                  ↑{aheadBehind.ahead}
                </span>
              )}
              {aheadBehind.behind > 0 && (
                <span
                  title={t('behind', { count: aheadBehind.behind })}
                  aria-label={t('behind', { count: aheadBehind.behind })}
                >
                  ↓{aheadBehind.behind}
                </span>
              )}
            </span>
          </>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
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
