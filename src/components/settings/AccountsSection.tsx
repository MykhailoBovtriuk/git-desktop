import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { showErrorToast } from '../../stores/error-toast';
import { useAccountStore } from '../../stores/account-store';
import { useRepoStore } from '../../stores/repo-store';
import { basenameFromPath } from '../../lib/basename';
import { AccountCard, TestButton } from '../account/AccountCard';
import { TestStatus } from '../account/TestStatus';
import { Avatar, Button, TruncatedText } from '../../shared/ui';
import type { ProviderAccount, RemoteProtocol } from '../../types';

function noCardHintKey(protocol: RemoteProtocol | null, remoteUrl: string | null): string {
  if (protocol === 'ssh') return 'section.ssh';
  if (remoteUrl) return 'section.noSignIn';
  return 'section.noRemote';
}

export function AccountsSection() {
  const { t } = useTranslation('account');
  const { repoPath, remoteUrl, remoteHost, remoteProtocol } = useRepoStore(
    useShallow(s => ({
      repoPath: s.repoPath,
      remoteUrl: s.remoteUrl,
      remoteHost: s.remoteHost,
      remoteProtocol: s.remoteProtocol,
    })),
  );
  const persistent = useAccountStore(s => s.persistent);

  return (
    <section className="py-4 flex flex-col gap-4">
      {repoPath ? (
        <div className="flex flex-col gap-4">
          {remoteProtocol === 'https' && (
            <p className="text-subtext text-xs">
              {t('section.repoHint', { repo: basenameFromPath(repoPath) })}
            </p>
          )}
          {remoteHost ? (
            <AccountCard />
          ) : (
            <p className="text-subtext text-xs">{t(noCardHintKey(remoteProtocol, remoteUrl))}</p>
          )}
        </div>
      ) : (
        <SignedInRepos />
      )}

      {!persistent && <p className="text-yellow text-xs">{t('section.notPersistent')}</p>}
    </section>
  );
}

function SignedInRepos() {
  const { t } = useTranslation('account');
  const { accounts, signOut } = useAccountStore(
    useShallow(s => ({ accounts: s.accounts, signOut: s.signOut })),
  );

  return (
    <div className="flex flex-col gap-2">
      <p className="text-subtext text-xs">{t('section.noRepo')}</p>
      {accounts.length > 0 && (
        <>
          <h2 className="text-text text-sm font-medium mt-2">{t('section.signedInRepos')}</h2>
          <ul className="flex flex-col gap-2">
            {accounts.map(account => (
              <RepoAccountRow
                key={account.repoPath}
                account={account}
                onSignOut={() =>
                  void signOut(account.repoPath).catch(err =>
                    showErrorToast(t('section.signOutFailed'), err),
                  )
                }
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function RepoAccountRow({
  account,
  onSignOut,
}: {
  account: ProviderAccount;
  onSignOut: () => void;
}) {
  const { t } = useTranslation('account');
  return (
    <li className="bg-mantle rounded flex flex-col">
      <div className="p-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar src={account.avatarDataUrl} size="md" />
          <div className="min-w-0">
            <TruncatedText as="p" className="text-text text-sm">
              {basenameFromPath(account.repoPath)}
            </TruncatedText>
            <TruncatedText as="p" className="text-subtext text-xs font-mono">
              {account.repoPath}
            </TruncatedText>
            <TruncatedText as="p" className="text-subtext text-xs">
              {`@${account.login} · ${account.host}`}
            </TruncatedText>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <TestButton repoPath={account.repoPath} host={account.host} />
          <Button variant="secondary" size="sm" onClick={onSignOut}>
            {t('section.signOut')}
          </Button>
        </div>
      </div>
      <TestStatus
        repoPath={account.repoPath}
        host={account.host}
        className="p-3 border-t border-surface0"
      />
    </li>
  );
}
