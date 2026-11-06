import type { TFunction } from 'i18next';
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
import { connectionSource, freshIdentity } from '../account/connection-source';
import type { AuthSource, ProviderAccount } from '../../types';

interface AccountIndicator {
  label: string;
  title: string;
  className: string;
}

function accountIndicator(
  t: TFunction<'footer'>,
  account: ProviderAccount | null,
  authSource: AuthSource | null,
  knownLogin: string | null,
): AccountIndicator {
  if (account) {
    return {
      label: `@${account.login}`,
      title: t('account.signedInAs', { name: account.name || account.login, host: account.host }),
      className: 'text-text',
    };
  }
  const knownLabel = knownLogin ? `@${knownLogin}` : null;
  if (authSource === 'ssh') {
    return {
      label: knownLabel ?? t('account.viaSsh'),
      title: t('account.viaSshHint'),
      className: 'text-subtext',
    };
  }
  if (authSource === 'system' || authSource === 'gcm') {
    return {
      label: knownLabel ?? t('account.viaSystem'),
      title: t('account.viaSystemHint'),
      className: 'text-subtext',
    };
  }
  return { label: t('signIn'), title: t('signIn'), className: 'text-blue' };
}

export function Footer() {
  const { t } = useTranslation('footer');
  const { headCommit, aheadBehind } = useRepoStore(
    useShallow(s => ({ headCommit: s.headCommit, aheadBehind: s.aheadBehind })),
  );
  const { remoteHost, remoteProtocol } = useRepoStore(
    useShallow(s => ({ remoteHost: s.remoteHost, remoteProtocol: s.remoteProtocol })),
  );
  const openConnection = useUiStore(s => s.openConnection);
  const { run, loading: syncing } = useRemoteSync();
  const account = useCurrentAccount();
  const authSource = useAccountStore(s => s.authSource);
  const identity = useAccountStore(s => s.identity);
  const sourceInput = { protocol: remoteProtocol, host: remoteHost, account, authSource, identity };
  const source = account ? 'account' : connectionSource(sourceInput);
  const fresh = account ? null : freshIdentity(sourceInput);
  const knownIdentity = fresh?.login && fresh.source !== 'account' ? fresh : null;
  const avatarDataUrl = account?.avatarDataUrl ?? knownIdentity?.avatarDataUrl;

  const hash = headCommit ?? '—';
  const diverged = aheadBehind.ahead > 0 || aheadBehind.behind > 0;
  const pushTitle =
    aheadBehind.behind > 0
      ? t('pullFirst', { count: aheadBehind.behind })
      : t('ahead', { count: aheadBehind.ahead });
  const indicator = accountIndicator(t, account, source, knownIdentity?.login ?? null);

  return (
    <div className="relative h-10 bg-mantle border-t border-surface0 flex items-center justify-between px-3 shrink-0 select-none">
      <div className="shrink-0">
        <SidebarToggle />
      </div>
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 text-xs max-w-[45%]">
        <span className="text-blue shrink-0">●</span>
        <span className="text-subtext font-mono shrink-0">{hash}</span>
        {remoteHost && (account || source) && (
          <>
            <span className="text-surface2 shrink-0">|</span>
            <button
              onClick={openConnection}
              title={indicator.title}
              aria-label={indicator.title}
              className="flex items-center gap-1.5 min-w-0 rounded px-1 py-0.5 hover:bg-surface1 transition-colors"
            >
              <Avatar src={avatarDataUrl} size="sm" />
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
