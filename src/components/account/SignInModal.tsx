import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useAccountStore } from '../../stores/account-store';
import { openLogEntry, showErrorToast } from '../../stores/error-toast';
import { accountApi } from '../../api/account-api';
import { Button, Modal, TextInput } from '../../shared/ui';
import type { ProviderId } from '../../types';

export function SignInModal() {
  const { t } = useTranslation('account');
  const {
    phase,
    target,
    error,
    errorLogId,
    endpointError,
    busy,
    chooseProvider,
    confirmReplace,
    switchMethod,
    continueWithBrowser,
    submitToken,
    cancelSignIn,
  } = useAccountStore(
    useShallow(s => ({
      phase: s.phase,
      target: s.target,
      error: s.error,
      errorLogId: s.errorLogId,
      endpointError: s.endpointError,
      busy: s.busy,
      chooseProvider: s.chooseProvider,
      confirmReplace: s.confirmReplace,
      switchMethod: s.switchMethod,
      continueWithBrowser: s.continueWithBrowser,
      submitToken: s.submitToken,
      cancelSignIn: s.cancelSignIn,
    })),
  );

  const [picked, setPicked] = useState<string | null>(null);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [token, setToken] = useState('');

  if (!phase || !target) return null;

  const provider = target.options.find(o => o.id === (target.providerId ?? picked));
  const cancel = () => {
    setPicked(null);
    setClientId('');
    setClientSecret('');
    setToken('');
    void cancelSignIn();
  };

  // The dialog sits over the panel, so the link closes it to show the entry.
  const errorLine = (
    <div className="flex flex-col gap-1">
      <p className="text-red text-xs">{error}</p>
      {errorLogId && (
        <Button
          size="sm"
          variant="link"
          className="self-start"
          onClick={() => {
            cancel();
            openLogEntry(errorLogId);
          }}
        >
          {t('logs:showInLogs')}
        </Button>
      )}
    </div>
  );

  const footer = (primary: React.ReactNode) => (
    <>
      <Button variant="secondary" size="sm" onClick={cancel}>
        {t('common:cancel')}
      </Button>
      {primary}
    </>
  );

  const endpointMessage =
    endpointError && t(`endpoint.error.${endpointError}`, { service: provider?.displayName ?? '' });

  if (phase === 'choose') {
    return (
      <Modal
        title={t('choose.title', { host: target.host })}
        subtitle={t('choose.hint')}
        onClose={cancel}
        footer={footer(
          <Button
            variant="primary"
            size="sm"
            disabled={!picked || busy}
            onClick={() => picked && void chooseProvider(picked as ProviderId)}
          >
            {t('choose.continue')}
          </Button>,
        )}
      >
        <div className="flex flex-col gap-1">
          {target.options
            .filter(o => o.needsHost)
            .map(option => (
              <label
                key={option.id}
                className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-surface1 cursor-pointer"
              >
                <input
                  type="radio"
                  name="provider"
                  checked={picked === option.id}
                  onChange={() => setPicked(option.id)}
                />
                <span className="text-text text-sm">{option.displayName}</span>
              </label>
            ))}
          {endpointMessage && <p className="text-red text-xs mt-2">{endpointMessage}</p>}
        </div>
      </Modal>
    );
  }

  if (phase === 'existing' && target.existing) {
    const who = target.existing.name || target.existing.login;
    return (
      <Modal
        title={t('existing.title')}
        onClose={cancel}
        footer={footer(
          <Button variant="primary" size="sm" onClick={confirmReplace}>
            {t('existing.continue')}
          </Button>,
        )}
      >
        <p className="text-subtext text-sm">
          {t('existing.body', {
            name: who,
            login: target.existing.login,
            host: target.existing.host,
          })}
        </p>
      </Modal>
    );
  }

  const switchLink = (to: 'browser' | 'token', label: string) => (
    <Button
      type="button"
      variant="link"
      size="xs"
      onClick={() => switchMethod(to)}
      className="self-start"
    >
      {label}
    </Button>
  );

  if (phase === 'token') {
    const ready = !!token.trim();
    const submit = () => void submitToken(token.trim());
    return (
      <Modal
        title={t('token.title', { host: target.host })}
        subtitle={t('token.hint')}
        onClose={cancel}
        footer={footer(
          <Button variant="primary" size="sm" disabled={busy || !ready} onClick={submit}>
            {t('token.submit')}
          </Button>,
        )}
      >
        <div className="flex flex-col gap-2">
          <TextInput
            variant="modal"
            type="password"
            autoFocus
            aria-label={t('token.tokenPlaceholder')}
            value={token}
            onChange={e => setToken(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && ready && !busy) submit();
            }}
            placeholder={t('token.tokenPlaceholder')}
          />
          {provider && (
            <Button
              type="button"
              variant="link"
              size="xs"
              onClick={() =>
                void accountApi
                  .openTokenHelp(provider.id, target.host)
                  .catch(err => showErrorToast(t('token.helpFailed'), err))
              }
              className="self-start"
            >
              {t('token.where')}
            </Button>
          )}
          {provider?.configured
            ? switchLink('browser', t('token.useBrowser'))
            : provider?.needsClientId && switchLink('browser', t('token.useOwnApp'))}
          {error && errorLine}
        </div>
      </Modal>
    );
  }

  if (phase === 'error') {
    return (
      <Modal
        title={t('error.title')}
        onClose={cancel}
        footer={footer(
          <Button variant="primary" size="sm" onClick={() => switchMethod('token')}>
            {t('error.useToken')}
          </Button>,
        )}
      >
        {errorLine}
      </Modal>
    );
  }

  const waiting = phase === 'waiting';
  const needsClientId = !!provider?.needsClientId;
  const needsClientSecret = !!provider?.needsClientSecret;
  const appMissing =
    (needsClientId && !clientId.trim()) || (needsClientSecret && !clientSecret.trim());

  return (
    <Modal
      title={t('browser.title')}
      onClose={cancel}
      footer={footer(
        <Button
          variant="primary"
          size="sm"
          disabled={busy || appMissing}
          onClick={() => void continueWithBrowser(clientId.trim(), clientSecret.trim())}
        >
          {waiting ? t('browser.reopen') : t('browser.continue')}
        </Button>,
      )}
    >
      <div className="flex flex-col gap-3">
        <p className="text-subtext text-sm">{t('browser.body')}</p>

        {needsClientId && (
          <div className="flex flex-col gap-2">
            <TextInput
              variant="modal"
              aria-label={t('browser.clientIdPlaceholder')}
              value={clientId}
              onChange={e => setClientId(e.target.value)}
              placeholder={t('browser.clientIdPlaceholder')}
            />
            {needsClientSecret && (
              <TextInput
                variant="modal"
                type="password"
                aria-label={t('browser.clientSecretPlaceholder')}
                value={clientSecret}
                onChange={e => setClientSecret(e.target.value)}
                placeholder={t('browser.clientSecretPlaceholder')}
              />
            )}
            <p className="text-subtext text-xs">{t('browser.selfHostedHint')}</p>
          </div>
        )}

        {waiting && <p className="text-subtext text-xs">{t('browser.waiting')}</p>}
        {!waiting && switchLink('token', t('browser.useToken'))}
        {error && errorLine}
      </div>
    </Modal>
  );
}
