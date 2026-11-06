import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useAccountStore } from '../../stores/account-store';
import { testKey } from '../../lib/test-key';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { useBusy } from '../../hooks/use-busy';
import { useAsync } from '../../hooks/use-async';
import { useCurrentAccount } from '../../hooks/use-current-account';
import { accountApi } from '../../api/account-api';
import { showErrorToast } from '../../stores/error-toast';
import { Avatar, Button, KeyIcon, TruncatedText } from '../../shared/ui';
import { ProtocolSwitch } from './ProtocolSwitch';
import { TestStatus } from './TestStatus';
import { connectionSource, freshIdentity } from './connection-source';
import type { AuthSource, CredentialHelperEntry, SwitchableProtocol } from '../../types';

export function TestButton({ repoPath, host }: { repoPath: string; host: string }) {
  const { t } = useTranslation('account');
  const testing = useAccountStore(s => !!s.testing[testKey(host, repoPath)]);
  const runTest = useAccountStore(s => s.runTest);
  return (
    <Button
      variant="surface"
      size="sm"
      disabled={testing}
      aria-busy={testing}
      onClick={() => void runTest(repoPath, host)}
    >
      {t('card.test')}
    </Button>
  );
}

export function AccountCard({ onSignIn }: { onSignIn?: () => void }) {
  const { t } = useTranslation('account');
  const requestConfirm = useUiStore(s => s.requestConfirm);
  const { repoPath, remoteUrl, remoteHost, remoteProtocol } = useRepoStore(
    useShallow(s => ({
      repoPath: s.repoPath,
      remoteUrl: s.remoteUrl,
      remoteHost: s.remoteHost,
      remoteProtocol: s.remoteProtocol,
    })),
  );
  const current = useCurrentAccount();
  const store = useAccountStore(
    useShallow(s => ({
      authSource: s.authSource,
      identity: s.identity,
      openSignIn: s.openSignIn,
      signOut: s.signOut,
      forgetSystemCredential: s.forgetSystemCredential,
      refreshAuthSource: s.refreshAuthSource,
      runTest: s.runTest,
      clearTest: s.clearTest,
    })),
  );
  const [busy, track] = useBusy();
  const input = {
    protocol: remoteProtocol,
    host: remoteHost,
    account: current,
    authSource: store.authSource,
    identity: store.identity,
  };
  const source = connectionSource(input);
  const identity = freshIdentity(input);
  const service = useAsync(
    () => (remoteHost ? accountApi.providersFor(remoteHost) : Promise.resolve(null)),
    [remoteHost],
  );

  if (!repoPath || !remoteHost) return null;
  const host = remoteHost;
  const switchable = remoteProtocol === 'ssh' || remoteProtocol === 'https';

  const refresh = () => store.refreshAuthSource(host, remoteProtocol, repoPath);
  const act = (fn: () => Promise<void>, failed: string) =>
    void track(fn).catch((err: unknown) => showErrorToast(failed, err));

  const onSwitched = (to: SwitchableProtocol) => {
    const switchedHost = useRepoStore.getState().remoteHost ?? host;
    // A result from the other protocol says nothing about this one.
    if (to === 'ssh') void store.runTest(repoPath, switchedHost);
    else store.clearTest(repoPath, switchedHost);
  };

  const signIn = () => {
    onSignIn?.();
    void store.openSignIn(host, repoPath);
  };

  const signOut = () =>
    act(async () => {
      await store.signOut(current!.repoPath);
      await refresh();
    }, t('section.signOutFailed'));

  const forget = () =>
    act(async () => {
      const ok = await requestConfirm({
        title: t('connection.forgetTitle'),
        message: t('connection.forgetConfirm', { host }),
        confirmLabel: t('connection.forget'),
        danger: true,
      });
      if (!ok) return;
      await store.forgetSystemCredential(host, repoPath);
      await refresh();
    }, t('connection.failed'));

  const serviceName = service?.options.find(o => o.id === service.providerId)?.displayName;
  const signInLabel = serviceName
    ? t('section.signInTo', { service: serviceName })
    : t('connection.signIn');

  let title: string;
  let detail: string | null;
  let note: string | null = null;
  let avatar: string | null = null;
  if (!switchable) {
    title = t('connection.local');
    detail = null;
  } else if (source === 'account' && current) {
    title = current.name || current.login;
    detail = `@${current.login} · ${host}`;
    avatar = current.avatarDataUrl;
  } else if (source === 'ssh') {
    title = identity?.login ? `@${identity.login}` : t('connection.ssh');
    detail = remoteUrl;
  } else if (source === 'system' || source === 'gcm') {
    title = identity?.name || (identity?.login ? `@${identity.login}` : t('connection.system'));
    detail = identity?.login ? `@${identity.login} · ${host}` : host;
    avatar = identity?.avatarDataUrl ?? null;
    if (identity?.profile === 'rejected') note = t('card.rejected');
  } else if (source === 'none') {
    title = t('connection.none');
    detail = null;
    note = t('connection.noneHint');
  } else {
    title = t('common:loading');
    detail = null;
  }

  const helpers = identity?.helpers ?? [];
  const sourceLine = switchable && source ? sourceText(t, source, helpers) : null;
  const canTest = switchable && source !== null && source !== 'none';

  return (
    <div className="bg-mantle rounded flex flex-col">
      {switchable && (
        <div className="p-3 border-b border-surface0">
          <ProtocolSwitch onSwitched={onSwitched} />
        </div>
      )}
      <div className="p-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-3 min-w-0 flex-1 basis-60">
          {source === 'ssh' ? (
            <KeyIcon size={20} aria-hidden="true" className="shrink-0 text-subtext" />
          ) : (
            <Avatar src={avatar} size="md" />
          )}
          <div className="min-w-0">
            <p className="text-text text-sm break-words">{title}</p>
            {detail && (
              <TruncatedText as="p" className="text-subtext text-xs font-mono">
                {detail}
              </TruncatedText>
            )}
            {note && (
              <p className={source === 'none' ? 'text-subtext text-xs' : 'text-yellow text-xs'}>
                {note}
              </p>
            )}
            {sourceLine && (
              <TruncatedText as="p" className="text-subtext text-xs">
                {sourceLine}
              </TruncatedText>
            )}
          </div>
        </div>
        <div data-testid="card-actions" className="flex items-center gap-2 shrink-0 ml-auto">
          {canTest && <TestButton repoPath={repoPath} host={host} />}
          {source === 'account' && current && (
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              title={t('connection.signOutHint', { host })}
              onClick={signOut}
            >
              {t('section.signOut')}
            </Button>
          )}
          {(source === 'system' || source === 'gcm') && (
            <>
              <Button variant="secondary" size="sm" disabled={busy} onClick={forget}>
                {t('connection.forget')}
              </Button>
              <Button variant="secondary" size="sm" disabled={busy} onClick={signIn}>
                {t('card.signInInstead')}
              </Button>
            </>
          )}
          {source === 'none' && remoteProtocol === 'https' && (
            <Button size="sm" disabled={busy} onClick={signIn}>
              {signInLabel}
            </Button>
          )}
        </div>
      </div>
      {canTest && (
        <TestStatus repoPath={repoPath} host={host} className="p-3 border-t border-surface0" />
      )}
    </div>
  );
}

function helperName(t: TFunction<'account'>, entry: CredentialHelperEntry): string {
  if (entry.cli) return t(`card.helper.${entry.cli}`);
  const command = entry.helper.replace(/^!\s*/, '').split(/\s+/)[0] ?? entry.helper;
  const base = command.split(/[\\/]/).pop() || command;
  return base.replace(/^git-credential-/, '').replace(/\.exe$/i, '');
}

function sourceText(
  t: TFunction<'account'>,
  source: AuthSource,
  helpers: CredentialHelperEntry[],
): string {
  const name = t(`card.sources.${source}`);
  if ((source === 'system' || source === 'gcm') && helpers.length > 0) {
    const via = helpers.map(h => helperName(t, h)).join(', ');
    return t('card.sourceVia', { source: name, via });
  }
  return t('card.source', { source: name });
}
