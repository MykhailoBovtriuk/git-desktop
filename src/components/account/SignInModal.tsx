import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useAccountStore } from '../../stores/account-store';
import { useRepoStore } from '../../stores/repo-store';
import { accountApi } from '../../api/account-api';
import { Button, Modal, TextInput } from '../../shared/ui';
import type { ProviderId } from '../../types';

export function SignInModal() {
  const { t } = useTranslation('account');
  const {
    phase,
    target,
    error,
    endpointError,
    busy,
    chooseProvider,
    submitEndpoint,
    confirmReplace,
    switchMethod,
    continueWithBrowser,
    submitToken,
    cancelSignIn,
    dismissForRepo,
  } = useAccountStore(
    useShallow(s => ({
      phase: s.phase,
      target: s.target,
      error: s.error,
      endpointError: s.endpointError,
      busy: s.busy,
      chooseProvider: s.chooseProvider,
      submitEndpoint: s.submitEndpoint,
      confirmReplace: s.confirmReplace,
      switchMethod: s.switchMethod,
      continueWithBrowser: s.continueWithBrowser,
      submitToken: s.submitToken,
      cancelSignIn: s.cancelSignIn,
      dismissForRepo: s.dismissForRepo,
    })),
  );
  const repoPath = useRepoStore(s => s.repoPath);

  const [picked, setPicked] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [login, setLogin] = useState('');
  const [token, setToken] = useState('');

  if (!phase || !target) return null;

  const provider = target.options.find(o => o.id === (target.providerId ?? picked));
  const service = provider?.displayName ?? target.host;
  const cancel = () => {
    setPicked(null);
    setAddress(null);
    setClientId('');
    setClientSecret('');
    setLogin('');
    setToken('');
    if (target.repoPath && target.repoPath === repoPath) dismissForRepo(repoPath);
    void cancelSignIn();
  };

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
                <span className="text-text text-sm">
                  {option.id === 'token' ? t('token.otherServer') : option.displayName}
                </span>
              </label>
            ))}
          {endpointMessage && <p className="text-red text-xs mt-2">{endpointMessage}</p>}
        </div>
      </Modal>
    );
  }

  if (phase === 'endpoint') {
    const value = address ?? target.host;
    const submit = () => void submitEndpoint(value);
    return (
      <Modal
        title={t('endpoint.title', {
          service: provider?.id === 'token' ? t('token.otherServer') : service,
        })}
        subtitle={t(`endpoint.hint.${provider?.group === 'other' ? 'other' : 'enterprise'}`)}
        onClose={cancel}
        footer={footer(
          <Button variant="primary" size="sm" disabled={busy || !value.trim()} onClick={submit}>
            {t('choose.continue')}
          </Button>,
        )}
      >
        <div className="flex flex-col gap-2">
          <TextInput
            variant="modal"
            autoFocus
            aria-label={t('endpoint.label')}
            value={value}
            onChange={e => setAddress(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && value.trim() && !busy) submit();
            }}
            placeholder={t(`endpoint.placeholder.${provider?.id ?? 'token'}`, {
              defaultValue: t('endpoint.placeholder.token'),
            })}
          />
          {endpointMessage && <p className="text-red text-xs">{endpointMessage}</p>}
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
    <button
      type="button"
      onClick={() => switchMethod(to)}
      className="text-blue text-xs hover:underline self-start"
    >
      {label}
    </button>
  );

  if (phase === 'token') {
    const needsLogin = !target.providerId || target.providerId === 'token';
    const ready = !!token.trim() && (!needsLogin || !!login.trim());
    const submit = () => void submitToken(needsLogin ? login.trim() : '', token.trim());
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
          {needsLogin && (
            <TextInput
              variant="modal"
              autoFocus
              aria-label={t('token.usernamePlaceholder')}
              value={login}
              onChange={e => setLogin(e.target.value)}
              placeholder={t('token.usernamePlaceholder')}
            />
          )}
          <TextInput
            variant="modal"
            type="password"
            autoFocus={!needsLogin}
            aria-label={t('token.tokenPlaceholder')}
            value={token}
            onChange={e => setToken(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && ready && !busy) submit();
            }}
            placeholder={t('token.tokenPlaceholder')}
          />
          {provider?.id && provider.id !== 'token' && (
            <button
              type="button"
              onClick={() =>
                void accountApi.openTokenHelp(provider.id, target.host).catch(() => {})
              }
              className="text-blue text-xs hover:underline self-start"
            >
              {t('token.where')}
            </button>
          )}
          {provider?.configured
            ? switchLink('browser', t('token.useBrowser'))
            : provider?.needsClientId && switchLink('browser', t('token.useOwnApp'))}
          {error && <p className="text-red text-xs">{error}</p>}
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
        <p className="text-red text-xs">{error}</p>
      </Modal>
    );
  }

  const waiting = phase === 'waiting';
  const needsClientId = !!provider?.needsClientId;

  return (
    <Modal
      title={t('browser.title')}
      onClose={cancel}
      footer={footer(
        <Button
          variant="primary"
          size="sm"
          disabled={busy || (needsClientId && !clientId.trim())}
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
            {/* GitHub Enterprise is the only self-hosted provider whose flow
                cannot use PKCE, so it is the only one that has to ask. */}
            {provider?.id === 'github-enterprise' && (
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
        {error && <p className="text-red text-xs">{error}</p>}
      </div>
    </Modal>
  );
}
