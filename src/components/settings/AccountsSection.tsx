import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useAccountStore } from '../../stores/account-store';
import { useRepoStore } from '../../stores/repo-store';
import { Button, TextInput, UserIcon } from '../../shared/ui';

/**
 * Every server this user is signed in to, one row each.
 *
 * A list rather than a single account because being signed in to github.com, a
 * work GitLab and Azure DevOps at once is the normal case, not an edge one —
 * and signing out of one must visibly not touch the others.
 */
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
        <Button variant="secondary" size="sm" className="mt-3" onClick={startAdd}>
          {t('section.add')}
        </Button>
      )}

      {/* A machine with no OS keychain cannot keep a token safely, and the app
          refuses to write one in the clear — so say the session is all there is
          rather than letting the user find out at the next launch. */}
      {!persistent && <p className="text-yellow text-xs mt-3">{t('section.notPersistent')}</p>}
    </section>
  );
}
