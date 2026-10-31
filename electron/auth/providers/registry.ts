import type { ProviderId, ProviderOption } from '../../../src/types';
import { keysFor } from '../oauth-config';
import { github, githubEnterprise } from './github';
import { gitlab, gitlabSelf } from './gitlab';
import { azureDevOps, azureDevOpsServer } from './azure-devops';
import { bitbucket, bitbucketServer } from './bitbucket';
import { gitea } from './gitea';
import { tokenProvider } from './token';
import type { ProviderDefinition } from './types';

/**
 * Order decides which provider claims a shared host and the order in the
 * sign-in picker.
 */
const PROVIDERS: ProviderDefinition[] = [
  github,
  gitlab,
  azureDevOps,
  bitbucket,
  gitea,
  githubEnterprise,
  gitlabSelf,
  bitbucketServer,
  azureDevOpsServer,
  tokenProvider,
];

export function allProviders(): ProviderDefinition[] {
  return PROVIDERS;
}

export function providerById(id: ProviderId): ProviderDefinition | null {
  return PROVIDERS.find(p => p.id === id) ?? null;
}

export function providerForHost(host: string): ProviderDefinition | null {
  const needle = host.toLowerCase();
  return PROVIDERS.find(p => p.knownHosts.includes(needle)) ?? null;
}

const NEEDS_HOST: ReadonlySet<ProviderId> = new Set<ProviderId>([
  'github-enterprise',
  'gitlab-self',
  'gitea',
  'bitbucket-server',
  'azure-devops-server',
  'token',
]);

/**
 * Whether the browser flow needs a client id from the user. A baked Gitea key
 * belongs to Codeberg's app and means nothing to someone else's instance.
 */
function needsClientId(id: ProviderId, host: string | null): boolean {
  if (id === 'token' || providerById(id)?.oauth === false) return false;
  if (keysFor(id) === null) return true;
  return id === 'gitea' && host !== 'codeberg.org';
}

export function providerOptions(host: string | null): ProviderOption[] {
  return PROVIDERS.map(p => {
    const ownApp = needsClientId(p.id, host);
    return {
      id: p.id,
      displayName: p.displayName,
      group: p.group,
      defaultHost: p.knownHosts[0] ?? null,
      configured: p.id !== 'token' && p.oauth !== false && !ownApp,
      needsHost: NEEDS_HOST.has(p.id),
      needsClientId: ownApp,
      needsClientSecret: ownApp && !p.usesPkce,
    };
  });
}
