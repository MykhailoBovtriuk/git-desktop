import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { useAccountStore } from '../../stores/account-store';
import { Avatar, cn } from '../../shared/ui';
import { PanelButtons } from './PanelButtons';
import { SidebarToggle } from './SidebarToggle';
import { useCurrentAccount } from '../../hooks/use-current-account';
import { useRemoteSync } from '../../hooks/use-remote-sync';

export function Footer() {
  const { t } = useTranslation('footer');
  const { headCommit, aheadBehind } = useRepoStore(
    useShallow(s => ({ headCommit: s.headCommit, aheadBehind: s.aheadBehind })),
  );
  const remoteHost = useRepoStore(s => s.remoteHost);
  const openConnection = useUiStore(s => s.openConnection);
  const { run, loading: syncing } = useRemoteSync();
  const account = useCurrentAccount();
  const authSource = useAccountStore(s => s.authSource);

  const hash = headCommit ?? '—';
  const diverged = aheadBehind.ahead > 0 || aheadBehind.behind > 0;
  const pushTitle =
    aheadBehind.behind > 0
      ? t('pullFirst', { count: aheadBehind.behind })
      : t('ahead', { count: aheadBehind.ahead });
  const indicator = account
    ? {
        label: `@${account.login}`,
        title: t('account.signedInAs', { name: account.name || account.login, host: account.host }),
        className: 'text-text',
      }
    : authSource === 'ssh'
      ? { label: t('account.viaSsh'), title: t('account.viaSshHint'), className: 'text-subtext' }
      : authSource === 'system'
        ? {
            label: t('account.viaSystem'),
            title: t('account.viaSystemHint'),
            className: 'text-subtext',
          }
        : { label: t('signIn'), title: t('signIn'), className: 'text-blue' };

  return (
    <div className="relative h-10 bg-mantle border-t border-surface0 flex items-center justify-between px-3 shrink-0 select-none">
      <div className="shrink-0">
        <SidebarToggle />
      </div>
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 text-xs max-w-[45%]">
        <span className="text-blue shrink-0">●</span>
        <span className="text-subtext font-mono shrink-0">{hash}</span>
        {remoteHost && (account || authSource) && (
          <>
            <span className="text-surface2 shrink-0">|</span>
            <button
              onClick={openConnection}
              title={indicator.title}
              aria-label={indicator.title}
              className="flex items-center gap-1.5 min-w-0 rounded px-1 py-0.5 hover:bg-surface1 transition-colors"
            >
              <Avatar src={account?.avatarDataUrl} size="sm" />
              <span className={cn('truncate', indicator.className)}>{indicator.label}</span>
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

      <div className="shrink-0">
        <PanelButtons />
      </div>
    </div>
  );
}
