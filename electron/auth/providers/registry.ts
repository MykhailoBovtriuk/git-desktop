import type { ProviderId, ProviderOption } from '../../../src/types';
import { keysFor } from '../oauth-config';
import { github, githubEnterprise } from './github';
import { gitlab, gitlabSelf } from './gitlab';
import { azureDevOps } from './azure-devops';
import { bitbucket } from './bitbucket';
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
  tokenProvider,
];

export function allProviders(): ProviderDefinition[] {
  return PROVIDERS;
}

export function providerById(id: ProviderId): ProviderDefinition | null {
  return PROVIDERS.find(p => p.id === id) ?? null;
}

/**
 * The provider that owns a host, or null when nobody claims it; that means
 * asking the user, not an error.
 */
export function providerForHost(host: string): ProviderDefinition | null {
  const needle = host.toLowerCase();
  return PROVIDERS.find(p => p.knownHosts.includes(needle)) ?? null;
}

/**
 * A provider is offerable when this build can complete its flow; self-hosted
 * variants and the token fallback always can.
 */
export function isConfigured(id: ProviderId): boolean {
  // Self-hosted services (Gitea included) register their OAuth app on the
  // user's instance, so the client id comes with the server address.
  if (NO_BAKED_KEY_NEEDED.has(id)) return true;
  return keysFor(id) !== null;
}

const NO_BAKED_KEY_NEEDED: ReadonlySet<ProviderId> = new Set<ProviderId>([
  'token',
  'gitlab-self',
  'github-enterprise',
  'gitea',
]);

const NEEDS_HOST: ReadonlySet<ProviderId> = new Set<ProviderId>([
  'github-enterprise',
  'gitlab-self',
  'gitea',
  'token',
]);

/** What the renderer needs to draw the picker, and nothing more. */
export function providerOptions(host: string | null): ProviderOption[] {
  return PROVIDERS.filter(p => isConfigured(p.id)).map(p => ({
    id: p.id,
    displayName: p.displayName,
    configured: true,
    needsHost: NEEDS_HOST.has(p.id),
    // Asking for a client id this build already carries would block sign-in on
    // a value the user has no way to know.
    needsClientId: p.id !== 'token' && keysFor(p.id) === null,
    tokenHelpUrl: host ? p.tokenHelpUrl(host) : null,
  }));
}
