import type { ProviderId, ProviderOption } from '../../../src/types';
import { keysFor } from '../oauth-config';
import { github, githubEnterprise } from './github';
import { gitlab, gitlabSelf } from './gitlab';
import { azureDevOps, azureDevOpsServer } from './azure-devops';
import type { ProviderDefinition } from './types';

/**
 * Order decides which provider claims a shared host and the order in the
 * sign-in picker.
 */
const PROVIDERS: ProviderDefinition[] = [
  github,
  gitlab,
  azureDevOps,
  githubEnterprise,
  gitlabSelf,
  azureDevOpsServer,
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
  'azure-devops-server',
]);

export function providerOptions(): ProviderOption[] {
  return PROVIDERS.map(p => {
    const ownApp = p.oauth !== false && keysFor(p.id) === null;
    return {
      id: p.id,
      displayName: p.displayName,
      group: p.group,
      defaultHost: p.knownHosts[0] ?? null,
      configured: p.oauth !== false && !ownApp,
      needsHost: NEEDS_HOST.has(p.id),
      needsClientId: ownApp,
      needsClientSecret: ownApp && !p.usesPkce,
    };
  });
}
