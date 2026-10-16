import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useAccountStore } from '../../stores/account-store';
import { useRepoStore } from '../../stores/repo-store';
import { basenameFromPath } from '../../lib/basename';
import { accountApi } from '../../api/account-api';
import { Badge, Button, TruncatedText, UserIcon, cn } from '../../shared/ui';
import type { CredentialHelperEntry, ProviderAccount, ProviderId } from '../../types';

type ServiceId = 'github' | 'gitlab' | 'bitbucket' | 'azure' | 'other';

interface ServiceDef {
  id: ServiceId;
  name: string | null;
  cloud: ProviderId;
  self: { provider: ProviderId; label: string } | null;
}

const SERVICES: ServiceDef[] = [
  {
    id: 'github',
    name: 'GitHub',
    cloud: 'github',
    self: { provider: 'github-enterprise', label: 'Enterprise' },
  },
  {
    id: 'gitlab',
    name: 'GitLab',
    cloud: 'gitlab',
    self: { provider: 'gitlab-self', label: 'Self-Managed' },
  },
  {
    id: 'bitbucket',
    name: 'Bitbucket',
    cloud: 'bitbucket',
    self: { provider: 'bitbucket-server', label: 'Data Center' },
  },
  {
    id: 'azure',
    name: 'Azure DevOps',
    cloud: 'azure-devops',
    self: { provider: 'azure-devops-server', label: 'Server' },
  },
  { id: 'other', name: null, cloud: 'token', self: null },
];

const providersOf = (service: ServiceDef): ProviderId[] =>
  service.self ? [service.cloud, service.self.provider] : [service.cloud];

function choiceFor(providerId: ProviderId): { service: ServiceDef; selfHosted: boolean } {
  const service = SERVICES.find(s => providersOf(s).includes(providerId)) ?? SERVICES[0];
  return { service, selfHosted: service.self?.provider === providerId };
}

export function AccountsSection() {
  const { t } = useTranslation('account');
  const repoPath = useRepoStore(s => s.repoPath);
  const { accounts, persistent, beginSignIn, signOut } = useAccountStore(
    useShallow(s => ({
      accounts: s.accounts,
      persistent: s.persistent,
      beginSignIn: s.beginSignIn,
      signOut: s.signOut,
    })),
  );
  const current = repoPath ? (accounts.find(a => a.repoPath === repoPath) ?? null) : null;
  const [serviceId, setServiceId] = useState<ServiceId>('github');
  const [selfHostedPick, setSelfHostedPick] = useState(false);

  useEffect(() => {
    if (!current) return;
    const choice = choiceFor(current.providerId);
    setServiceId(choice.service.id);
    setSelfHostedPick(choice.selfHosted);
  }, [current]);

  const locked = !!current;
  const choice = current
    ? choiceFor(current.providerId)
    : {
        service: SERVICES.find(s => s.id === serviceId) ?? SERVICES[0],
        selfHosted: selfHostedPick,
      };
  const { service, selfHosted } = choice;
  const provider = selfHosted && service.self ? service.self.provider : service.cloud;
  const serviceName = (s: ServiceDef) => s.name ?? t('service.other');
  const title =
    selfHosted && service.self
      ? `${serviceName(service)} ${service.self.label}`
      : serviceName(service);

  const pick = (next: ServiceDef) => {
    setServiceId(next.id);
    setSelfHostedPick(false);
  };

  return (
    <section className="py-4 flex flex-col gap-4">
      {repoPath ? (
        <p className="text-subtext text-xs">
          {t('section.repoHint', { repo: basenameFromPath(repoPath) })}
        </p>
      ) : (
        <p className="text-subtext text-xs">{t('section.noRepo')}</p>
      )}

      {repoPath && (
        <>
          <div
            role="radiogroup"
            aria-label={t('service.label')}
            className={cn('flex flex-wrap gap-x-5 gap-y-2', locked && 'opacity-60')}
          >
            {SERVICES.map(s => (
              <label
                key={s.id}
                className={cn(
                  'flex items-center gap-2 text-sm text-text',
                  locked ? 'cursor-default' : 'cursor-pointer',
                )}
              >
                <input
                  type="radio"
                  name="account-service"
                  className="accent-blue"
                  checked={s.id === service.id}
                  disabled={locked}
                  onChange={() => pick(s)}
                />
                {serviceName(s)}
              </label>
            ))}
          </div>

          {service.self && (
            <label
              className={cn(
                'flex items-center gap-2 text-sm text-text',
                locked ? 'cursor-default opacity-60' : 'cursor-pointer',
              )}
            >
              <input
                type="checkbox"
                className="accent-blue"
                checked={selfHosted}
                disabled={locked}
                onChange={e => setSelfHostedPick(e.target.checked)}
              />
              {service.self.label}
            </label>
          )}

          <div className="flex flex-col gap-2 border-t border-surface0 pt-4">
            <h2 className="text-text text-sm font-medium">{title}</h2>

            {current ? (
              <AccountRow
                account={current}
                showHost={!service.self || selfHosted}
                onSignOut={() => void signOut(current.repoPath)}
              />
            ) : (
              <div className="flex items-center justify-between gap-4">
                <p className="text-subtext text-xs">{t(`service.hint.${provider}`)}</p>
                <Button
                  size="sm"
                  className="shrink-0"
                  onClick={() => void beginSignIn(provider, repoPath)}
                >
                  {provider === 'token'
                    ? t('service.signInOther')
                    : t('service.signIn', { service: title })}
                </Button>
              </div>
            )}
          </div>
        </>
      )}

      <SystemCredentials />

      {!persistent && <p className="text-yellow text-xs">{t('section.notPersistent')}</p>}
    </section>
  );
}

function AccountRow({
  account,
  showHost,
  onSignOut,
}: {
  account: ProviderAccount;
  showHost: boolean;
  onSignOut: () => void;
}) {
  const { t } = useTranslation('account');
  return (
    <div className="bg-mantle rounded p-3 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        {account.avatarDataUrl ? (
          <img src={account.avatarDataUrl} alt="" className="w-8 h-8 rounded-full shrink-0" />
        ) : (
          <UserIcon size={20} aria-hidden="true" className="shrink-0 text-subtext" />
        )}
        <div className="min-w-0">
          <TruncatedText as="p" className="text-text text-sm">
            {account.name || account.login}
          </TruncatedText>
          <TruncatedText as="p" className="text-subtext text-xs">
            {showHost ? `@${account.login} · ${account.host}` : `@${account.login}`}
          </TruncatedText>
        </div>
      </div>
      <Button variant="secondary" size="sm" onClick={onSignOut}>
        {t('section.signOut')}
      </Button>
    </div>
  );
}

function SystemCredentials() {
  const { t } = useTranslation('account');
  const [helpers, setHelpers] = useState<CredentialHelperEntry[] | null>(null);

  useEffect(() => {
    let alive = true;
    void accountApi
      .credentialHelpers()
      .then(list => alive && setHelpers(list))
      .catch(() => alive && setHelpers([]));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="flex flex-col gap-2 border-t border-surface0 pt-4">
      <h2 className="text-text text-sm font-medium">{t('system.title')}</h2>
      <p className="text-subtext text-xs">{t('system.hint')}</p>

      {helpers && helpers.length === 0 && (
        <p className="text-subtext text-xs">{t('system.none')}</p>
      )}

      {helpers && helpers.length > 0 && (
        <ul className="flex flex-col gap-1">
          {helpers.map((entry, i) => (
            <li
              key={`${entry.scope}-${entry.url ?? '*'}-${i}`}
              className="bg-mantle rounded px-3 py-2 flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <TruncatedText as="p" className="text-text text-sm">
                  {entry.cli ? t(`system.cli.${entry.cli}`) : entry.helper}
                </TruncatedText>
                <TruncatedText as="p" className="text-subtext text-xs">
                  {entry.url ? t('system.forUrl', { url: entry.url }) : t('system.forAll')}
                </TruncatedText>
              </div>
              <Badge className="shrink-0">{t(`system.scope.${entry.scope}`)}</Badge>
            </li>
          ))}
        </ul>
      )}

      <p className="text-subtext text-xs">
        {t('system.cliHint')} <code className="font-mono">gh auth login</code>,{' '}
        <code className="font-mono">glab auth login</code>
      </p>
    </div>
  );
}
