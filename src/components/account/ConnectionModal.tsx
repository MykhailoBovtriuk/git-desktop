import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useAccountStore } from '../../stores/account-store';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { errorMessage } from '../../lib/error-message';
import { Button, Modal, SegmentedControl, UserIcon } from '../../shared/ui';

type Protocol = 'ssh' | 'https';

/**
 * Everything about how the open repository reaches its server, in one place:
 * which protocol, what authenticates it, and what can be done about either.
 */
export function ConnectionModal() {
  const { t } = useTranslation('account');
  const { open, close, requestConfirm, addToast } = useUiStore(
    useShallow(s => ({
      open: s.connectionOpen,
      close: s.closeConnection,
      requestConfirm: s.requestConfirm,
      addToast: s.addToast,
    })),
  );
  const { repoPath, remoteUrl, remoteHost, remoteProtocol, switchRemoteProtocol } = useRepoStore(
    useShallow(s => ({
      repoPath: s.repoPath,
      remoteUrl: s.remoteUrl,
      remoteHost: s.remoteHost,
      remoteProtocol: s.remoteProtocol,
      switchRemoteProtocol: s.switchRemoteProtocol,
    })),
  );
  const account = useAccountStore(
    useShallow(s => ({
      current: s.current,
      authSource: s.authSource,
      persistent: s.persistent,
      openSignIn: s.openSignIn,
      signOut: s.signOut,
      forgetSystemCredential: s.forgetSystemCredential,
      refreshAuthSource: s.refreshAuthSource,
      refreshCurrent: s.refreshCurrent,
    })),
  );
  const [busy, setBusy] = useState(false);

  if (!open || !remoteHost) return null;

  const protocol: Protocol | null =
    remoteProtocol === 'ssh' || remoteProtocol === 'https' ? remoteProtocol : null;

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (err: unknown) {
      addToast({
        variant: 'error',
        title: t('connection.failed'),
        message: errorMessage(err),
      });
    } finally {
      setBusy(false);
    }
  };

  const refresh = async () => {
    account.refreshCurrent(remoteHost);
    await account.refreshAuthSource(remoteHost, remoteProtocol);
  };

  const switchTo = (to: Protocol) => {
    if (busy || to === protocol) return;
    void act(() => switchRemoteProtocol(to));
  };

  const signIn = () => {
    close();
    void account.openSignIn(remoteHost, repoPath);
  };

  const signOut = (accountId: string) =>
    void act(async () => {
      await account.signOut(accountId);
      await refresh();
    });

  // The entry is shared with git in a terminal and anything else on the
  // machine, so erasing it is worth a second look.
  const forget = () =>
    void act(async () => {
      const ok = await requestConfirm({
        title: t('connection.forgetTitle'),
        message: t('connection.forgetConfirm', { host: remoteHost }),
        confirmLabel: t('connection.forget'),
        danger: true,
      });
      if (!ok) return;
      await account.forgetSystemCredential(remoteHost);
      await refresh();
    });

  return (
    <Modal
      title={t('connection.title')}
      subtitle={remoteUrl ? <span className="font-mono break-all">{remoteUrl}</span> : remoteHost}
      width="w-[75%] max-w-lg"
      onClose={close}
      footer={
        <Button variant="secondary" size="sm" onClick={close}>
          {t('common:done')}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {protocol ? (
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-text text-xs">{t('connection.protocol')}</p>
              <p className="text-subtext text-xs">{t('connection.protocolHint')}</p>
            </div>
            <SegmentedControl
              label={t('connection.protocol')}
              value={protocol}
              onChange={switchTo}
              options={[
                { value: 'ssh', label: 'SSH' },
                { value: 'https', label: 'HTTPS' },
              ]}
              className={busy ? 'opacity-50 pointer-events-none' : undefined}
            />
          </div>
        ) : null}

        <div className="bg-mantle rounded p-3 flex items-center justify-between gap-4">
          <AuthCard protocol={protocol} host={remoteHost} />
          <div className="flex items-center gap-2 shrink-0">
            {protocol === 'https' && account.current && (
              <Button
                variant="secondary"
                size="sm"
                disabled={busy}
                title={t('connection.signOutHint', { host: remoteHost })}
                onClick={() => signOut(account.current!.id)}
              >
                {t('section.signOut')}
              </Button>
            )}
            {protocol === 'https' && !account.current && account.authSource === 'system' && (
              <Button variant="secondary" size="sm" disabled={busy} onClick={forget}>
                {t('connection.forget')}
              </Button>
            )}
            {protocol === 'https' &&
              !account.current &&
              (account.authSource === 'system' || account.authSource === 'none') && (
                <Button
                  variant={account.authSource === 'none' ? 'primary' : 'secondary'}
                  size="sm"
                  disabled={busy}
                  onClick={signIn}
                >
                  {t('connection.signIn')}
                </Button>
              )}
          </div>
        </div>

        {protocol === 'https' && !account.persistent && (
          <p className="text-yellow text-xs">{t('section.notPersistent')}</p>
        )}
      </div>
    </Modal>
  );
}

/** What authenticates the repository right now, in words. */
function AuthCard({ protocol, host }: { protocol: Protocol | null; host: string }) {
  const { t } = useTranslation('account');
  const { current, authSource } = useAccountStore(
    useShallow(s => ({ current: s.current, authSource: s.authSource })),
  );

  let title: string;
  let detail: string | null = null;
  if (!protocol) {
    title = t('connection.local');
  } else if (protocol === 'ssh') {
    title = t('connection.ssh');
    detail = t('connection.sshHint');
  } else if (current) {
    title = t('signedInAs', { name: current.name || current.login, host });
    detail = `@${current.login}`;
  } else if (authSource === 'system') {
    title = t('connection.system');
    detail = t('connection.systemHint');
  } else if (authSource === 'none') {
    title = t('connection.none');
    detail = t('connection.noneHint');
  } else {
    title = t('common:loading');
  }

  return (
    <div className="flex items-center gap-3 min-w-0">
      {current?.avatarDataUrl && protocol === 'https' ? (
        <img src={current.avatarDataUrl} alt="" className="w-8 h-8 rounded-full shrink-0" />
      ) : (
        <UserIcon size={20} aria-hidden="true" className="shrink-0 text-subtext" />
      )}
      <div className="min-w-0">
        <p className="text-text text-sm">{title}</p>
        {detail && <p className="text-subtext text-xs">{detail}</p>}
      </div>
    </div>
  );
}
