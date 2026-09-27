import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useRepoStore } from '../../stores/repo-store';
import { selectSignInHost } from '../../stores/repo/selectors';
import { useUiStore } from '../../stores/ui-store';
import { useAccountStore } from '../../stores/account-store';
import { UserIcon } from '../../shared/ui';
import { AppMenuButtons } from './AppMenuButtons';
import { useRemoteSync } from '../../hooks/use-remote-sync';

export function Footer() {
  const { t } = useTranslation('footer');
  const { headCommit, aheadBehind } = useRepoStore(
    useShallow(s => ({ headCommit: s.headCommit, aheadBehind: s.aheadBehind })),
  );
  const signInHost = useRepoStore(selectSignInHost);
  const openOverlayView = useUiStore(s => s.openOverlayView);
  const { run, loading: syncing } = useRemoteSync();
  const { account, authSource, openSignIn } = useAccountStore(
    useShallow(s => ({ account: s.current, authSource: s.authSource, openSignIn: s.openSignIn })),
  );

  const hash = headCommit ?? '—';
  const diverged = aheadBehind.ahead > 0 || aheadBehind.behind > 0;
  const pushTitle =
    aheadBehind.behind > 0
      ? t('pullFirst', { count: aheadBehind.behind })
      : t('ahead', { count: aheadBehind.ahead });
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
              onClick={() => openOverlayView('settings')}
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
        {/* Authenticated, just not by us: say so instead of offering a needless
            sign-in. */}
        {!account && (authSource === 'system' || authSource === 'ssh') && (
          <>
            <span className="text-surface2 shrink-0">|</span>
            <span
              title={t(authSource === 'ssh' ? 'account.viaSshHint' : 'account.viaSystemHint')}
              className="flex items-center gap-1.5 min-w-0 px-1 py-0.5"
            >
              <UserIcon size={12} aria-hidden="true" className="shrink-0 text-subtext" />
              <span className="text-subtext truncate">
                {t(authSource === 'ssh' ? 'account.viaSsh' : 'account.viaSystem')}
              </span>
            </span>
          </>
        )}

        {/* Nothing authenticates this remote yet, so offer to sign in. A null
            source is still loading: better late than flashing the offer. */}
        {!account && authSource === 'none' && signInHost && (
          <>
            <span className="text-surface2 shrink-0">|</span>
            <button
              onClick={() => void openSignIn(signInHost)}
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
            <span className="flex items-center gap-0.5 text-subtext shrink-0">
              {/* Push would be rejected while the remote has commits we lack,
                  so ↑ waits for ↓ to be pulled first. */}
              {aheadBehind.ahead > 0 && (
                <button
                  onClick={() => void run('push')}
                  disabled={!!syncing || aheadBehind.behind > 0}
                  title={pushTitle}
                  aria-label={pushTitle}
                  className="text-blue rounded px-1 py-0.5 hover:bg-surface1 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  ↑{aheadBehind.ahead}
                </button>
              )}
              {aheadBehind.behind > 0 && (
                <button
                  onClick={() => void run('pull')}
                  disabled={!!syncing}
                  title={t('behind', { count: aheadBehind.behind })}
                  aria-label={t('behind', { count: aheadBehind.behind })}
                  className="rounded px-1 py-0.5 hover:bg-surface1 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
                >
                  ↓{aheadBehind.behind}
                </button>
              )}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
