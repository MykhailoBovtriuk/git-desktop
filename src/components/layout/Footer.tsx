import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { useAccountStore } from '../../stores/account-store';
import { classifyGitError } from '../../lib/git-error-mapper';
import { Button, UserIcon } from '../../shared/ui';
import { AppMenuButtons } from './AppMenuButtons';
import { errorMessage } from '../../lib/error-message';

export function Footer() {
  const { t } = useTranslation('footer');
  const { currentBranch, remoteHost, headCommit, aheadBehind, fetch, pull, push, publishBranch } =
    useRepoStore(
      useShallow(s => ({
        currentBranch: s.currentBranch,
        remoteHost: s.remoteHost,
        headCommit: s.headCommit,
        aheadBehind: s.aheadBehind,
        fetch: s.fetch,
        pull: s.pull,
        push: s.push,
        publishBranch: s.publishBranch,
      })),
    );
  const { addToast, openOverlayView } = useUiStore(
    useShallow(s => ({ addToast: s.addToast, openOverlayView: s.openOverlayView })),
  );
  const { account, openSignIn, changeAccountForRepo } = useAccountStore(
    useShallow(s => ({
      account: s.current,
      openSignIn: s.openSignIn,
      changeAccountForRepo: s.changeAccountForRepo,
    })),
  );
  const repoPath = useRepoStore(s => s.repoPath);
  const [loading, setLoading] = useState<'fetch' | 'pull' | 'push' | null>(null);

  // Through the same classifier as fetch/pull/push: publishing a new branch is
  // the likeliest first meeting with authentication, so raw stderr here left
  // the user with no way forward at exactly the wrong moment.
  const handlePublish = () => {
    void publishBranch()
      .then(() =>
        addToast({
          variant: 'success',
          title: t('publishBranch'),
          message: t('success', { op: t('push') }),
        }),
      )
      .catch((err: unknown) => {
        const raw = errorMessage(err);
        const { kind, action: errAction } = classifyGitError(err);
        const friendly = t(`error.${kind}`);
        addToast({
          variant: 'error',
          title: t('publishBranch'),
          message: friendly || raw,
          action:
            errAction === 'signIn' && remoteHost
              ? { label: t('signIn'), onClick: () => void openSignIn(remoteHost) }
              : undefined,
        });
      });
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
      const raw = errorMessage(err);
      const { kind, action: errAction } = classifyGitError(err);
      const friendly = t(`error.${kind}`);
      addToast({
        variant: 'error',
        title: t('failed', { op: label }),
        message: friendly || raw,
        action:
          errAction === 'publishBranch' && currentBranch
            ? { label: t('publishBranch'), onClick: handlePublish }
            : errAction === 'signIn' && remoteHost
              ? { label: t('signIn'), onClick: () => void openSignIn(remoteHost) }
              : undefined,
      });
    } finally {
      setLoading(null);
    }
  };

  const hash = headCommit ?? '—';
  const diverged = aheadBehind.ahead > 0 || aheadBehind.behind > 0;
  // The tooltip has to say it is clickable for a reason: the visible name is
  // the account this repository commits as, and that is changeable.
  const accountLabel = account
    ? t('account.signedInAs', { name: account.name || account.login, host: account.host })
    : '';

  return (
    <div className="relative h-10 bg-mantle border-t border-surface0 flex items-center justify-between px-3 shrink-0 select-none">
      <div className="shrink-0">
        <AppMenuButtons />
      </div>

      {/* Centred on the window rather than on the leftover space, so the
          readout does not drift as the side blocks change width. */}
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 text-xs max-w-[45%]">
        <span className="text-blue shrink-0">●</span>
        <span className="text-subtext font-mono shrink-0">{hash}</span>
        {account && (
          <>
            <span className="text-surface2 shrink-0">|</span>
            <button
              onClick={() =>
                repoPath && remoteHost
                  ? void changeAccountForRepo(repoPath, remoteHost)
                  : openOverlayView('settings')
              }
              title={accountLabel}
              aria-label={accountLabel}
              className="flex items-center gap-1.5 min-w-0 rounded px-1 py-0.5 hover:bg-surface1 transition-colors"
            >
              {account.avatarDataUrl ? (
                <img src={account.avatarDataUrl} alt="" className="w-4 h-4 rounded-full shrink-0" />
              ) : (
                <UserIcon size={12} aria-hidden="true" className="shrink-0 text-subtext" />
              )}
              <span className="text-text truncate">@{account.login}</span>
            </button>
          </>
        )}
        {/* No account but a remote to reach: the one thing worth offering here
            is the way to fix that, before a push fails and explains it. */}
        {!account && remoteHost && (
          <>
            <span className="text-surface2 shrink-0">|</span>
            <button
              onClick={() => void openSignIn(remoteHost)}
              className="flex items-center gap-1.5 min-w-0 rounded px-1 py-0.5 hover:bg-surface1 transition-colors"
            >
              <UserIcon size={12} aria-hidden="true" className="shrink-0 text-subtext" />
              <span className="text-blue truncate">{t('signIn')}</span>
            </button>
          </>
        )}
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
