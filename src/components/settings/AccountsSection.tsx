import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useAccountStore } from '../../stores/account-store';
import { useRepoStore } from '../../stores/repo-store';
import { useUiStore } from '../../stores/ui-store';
import { Button, TextInput, UserIcon } from '../../shared/ui';

/** Every server this user is signed in to, one row each. */
export function AccountsSection() {
  const { t } = useTranslation('account');
  const { accounts, persistent, openSignIn, signOut } = useAccountStore(
    useShallow(s => ({
      accounts: s.accounts,
      persistent: s.persistent,
      openSignIn: s.openSignIn,
      signOut: s.signOut,
    })),
  );
  const remoteHost = useRepoStore(s => s.remoteHost);
  const openConnection = useUiStore(s => s.openConnection);
  const [adding, setAdding] = useState(false);
  const [host, setHost] = useState('');

  const startAdd = () => {
    // The open repository's server is the one the user almost certainly means,
    // so offer it directly instead of asking them to type it.
    if (remoteHost && !accounts.some(a => a.host === remoteHost)) {
      void openSignIn(remoteHost);
      return;
    }
    setAdding(true);
  };

  return (
    <section className="border-b border-surface0 py-4 last:border-0">
      <h2 className="text-text text-sm font-medium">{t('section.title')}</h2>
      <p className="text-subtext text-xs mt-0.5 mb-3">{t('section.hint')}</p>

      {accounts.length === 0 && <p className="text-subtext text-xs mb-3">{t('section.empty')}</p>}

      <div className="flex flex-col gap-2">
        {accounts.map(account => (
          <div
            key={account.id}
            className="bg-mantle rounded p-3 flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3 min-w-0">
              {account.avatarDataUrl ? (
                <img src={account.avatarDataUrl} alt="" className="w-8 h-8 rounded-full shrink-0" />
              ) : (
                <UserIcon size={20} aria-hidden="true" className="shrink-0 text-subtext" />
              )}
              <div className="min-w-0">
                <p className="text-text text-sm truncate">{account.name || account.login}</p>
                <p className="text-subtext text-xs truncate">
                  @{account.login} · {account.host}
                </p>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={() => void signOut(account.id)}>
              {t('section.signOut')}
            </Button>
          </div>
        ))}
      </div>

      {adding ? (
        <div className="flex items-center gap-2 mt-3">
          <TextInput
            variant="modal"
            autoFocus
            value={host}
            onChange={e => setHost(e.target.value)}
            placeholder={t('section.hostPlaceholder')}
            className="flex-1"
          />
          <Button
            variant="primary"
            size="sm"
            disabled={!host.trim()}
            onClick={() => {
              void openSignIn(host.trim());
              setAdding(false);
              setHost('');
            }}
          >
            {t('section.add')}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setAdding(false)}>
            {t('common:cancel')}
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 mt-3">
          <Button variant="secondary" size="sm" onClick={startAdd}>
            {t('section.add')}
          </Button>
          {/* The same dialog as the footer's account chip, for whoever looks
              for it here. */}
          {remoteHost && (
            <Button
              variant="secondary"
              size="sm"
              title={t('section.connectionHint', { host: remoteHost })}
              onClick={openConnection}
            >
              {t('section.connection')}
            </Button>
          )}
        </div>
      )}

      {/* Without an OS keychain tokens last this session only; say so up front. */}
      {!persistent && <p className="text-yellow text-xs mt-3">{t('section.notPersistent')}</p>}
    </section>
  );
}
