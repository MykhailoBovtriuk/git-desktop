import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useAccountStore } from '../../stores/account-store';
import { useRepoStore } from '../../stores/repo-store';
import { accountApi } from '../../api/account-api';
import { Button, Modal, TextInput } from '../../shared/ui';
import type { ProviderId } from '../../types';

/**
 * The whole sign-in conversation, in one dialog.
 *
 * Four states rather than four screens: the user is answering one question —
 * "who are you on this server" — and the steps differ only in what the server
 * supports.
 */
export function SignInModal() {
  const { t } = useTranslation('account');
  const {
    phase,
    target,
    error,
    busy,
    chooseProvider,
    chooseAccount,
    setHost,
    continueWithBrowser,
    submitToken,
    cancelSignIn,
    dismissForRepo,
    openSignIn,
  } = useAccountStore(
    useShallow(s => ({
      phase: s.phase,
      target: s.target,
      error: s.error,
      busy: s.busy,
      chooseProvider: s.chooseProvider,
      chooseAccount: s.chooseAccount,
      setHost: s.setHost,
      continueWithBrowser: s.continueWithBrowser,
      submitToken: s.submitToken,
      cancelSignIn: s.cancelSignIn,
      dismissForRepo: s.dismissForRepo,
      openSignIn: s.openSignIn,
    })),
  );
  const repoPath = useRepoStore(s => s.repoPath);

  const [picked, setPicked] = useState<string | null>(null);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [login, setLogin] = useState('');
  const [token, setToken] = useState('');

  if (!phase || !target) return null;

  const provider = target.options.find(o => o.id === (picked ?? target.providerId));
  const cancel = () => {
    setPicked(null);
    setClientId('');
    setClientSecret('');
    setLogin('');
    setToken('');
    // "Not now" is an answer about this repository, for this session — so
    // re-opening it does not put the same dialog back in the user's way.
    if (repoPath) dismissForRepo(repoPath);
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

  // Several accounts already exist on this host. Which one owns this
  // repository is a question only the user can answer, and guessing it wrong
  // attributes their work to the wrong identity.
  if (phase === 'pick-account') {
    return (
      <Modal
        title={t('pick.title')}
        subtitle={t('pick.hint', { host: target.host })}
        onClose={cancel}
        footer={footer(
          <Button
            variant="primary"
            size="sm"
            disabled={busy || !picked}
            onClick={() => picked && void chooseAccount(picked)}
          >
            {t('pick.use')}
          </Button>,
        )}
      >
        <div className="flex flex-col gap-1">
          {target.candidates.map(account => (
            <label
              key={account.id}
              className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-surface1 cursor-pointer"
            >
              <input
                type="radio"
                name="account"
                checked={picked === account.id}
                onChange={() => setPicked(account.id)}
              />
              {account.avatarDataUrl && (
                <img src={account.avatarDataUrl} alt="" className="w-5 h-5 rounded-full" />
              )}
              <span className="text-text text-sm">
                {account.name || account.login}{' '}
                <span className="text-subtext">@{account.login}</span>
              </span>
            </label>
          ))}
          <button
            onClick={() => void openSignIn(target.host, target.repoPath)}
            className="text-blue text-xs hover:underline self-start mt-2 px-2"
          >
            {t('pick.another')}
          </button>
        </div>
      </Modal>
    );
  }

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
            disabled={!picked}
            onClick={() => picked && chooseProvider(picked as ProviderId)}
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
        </div>
      </Modal>
    );
  }

  if (phase === 'token') {
    return (
      <Modal
        title={t('token.title', { host: target.host })}
        subtitle={t('token.hint')}
        onClose={cancel}
        footer={footer(
          <Button
            variant="primary"
            size="sm"
            disabled={busy || !login.trim() || !token.trim()}
            onClick={() => void submitToken(login.trim(), token.trim())}
          >
            {t('token.submit')}
          </Button>,
        )}
      >
        <div className="flex flex-col gap-2">
          <TextInput
            variant="modal"
            autoFocus
            value={login}
            onChange={e => setLogin(e.target.value)}
            placeholder={t('token.usernamePlaceholder')}
          />
          <TextInput
            variant="modal"
            type="password"
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder={t('token.tokenPlaceholder')}
          />
          {provider?.tokenHelpUrl && (
            <button
              onClick={() =>
                void accountApi.openTokenHelp(provider.id, target.host).catch(() => {})
              }
              className="text-blue text-xs hover:underline self-start"
            >
              {t('token.where')}
            </button>
          )}
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
          <Button variant="primary" size="sm" onClick={() => chooseProvider('token')}>
            {t('error.useToken')}
          </Button>,
        )}
      >
        <p className="text-red text-xs">{error}</p>
      </Modal>
    );
  }

  // 'browser' and 'waiting' share a dialog: the second is the first with the
  // button already pressed, and swapping the whole panel would read as a step
  // backwards rather than progress.
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
            {provider?.needsHost && (
              <TextInput
                variant="modal"
                value={target.host}
                onChange={e => setHost(e.target.value)}
                placeholder={t('browser.hostPlaceholder')}
              />
            )}
            <TextInput
              variant="modal"
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
                value={clientSecret}
                onChange={e => setClientSecret(e.target.value)}
                placeholder={t('browser.clientSecretPlaceholder')}
              />
            )}
            <p className="text-subtext text-xs">{t('browser.selfHostedHint')}</p>
          </div>
        )}

        {waiting && <p className="text-subtext text-xs">{t('browser.waiting')}</p>}
        {error && <p className="text-red text-xs">{error}</p>}
      </div>
    </Modal>
  );
}
