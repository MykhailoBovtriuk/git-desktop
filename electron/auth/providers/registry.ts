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
 * Order matters twice: it decides which provider claims a host when two list
 * it, and it is the order the sign-in picker shows. Hosted services first,
 * self-hosted variants after, the manual fallback last.
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
 * The provider that owns a host, or null when nobody claims it — which is the
 * signal to ask the user, not an error. Most Git servers in the world are
 * somebody's self-hosted instance.
 */
export function providerForHost(host: string): ProviderDefinition | null {
  const needle = host.toLowerCase();
  return PROVIDERS.find(p => p.knownHosts.includes(needle)) ?? null;
}

/**
 * A provider is offerable when the build can actually complete its flow.
 * Self-hosted variants and the token fallback always can: they need no baked-in
 * key, or they take one from the user along with the server address.
 */
export function isConfigured(id: ProviderId): boolean {
  // Self-hosted services register their OAuth app on the user's own instance,
  // so a client id arrives with the server address rather than from the build.
  // Gitea belongs here too: leaving it out hid Codeberg and every self-hosted
  // Forgejo from a build with no Gitea key, which is most builds.
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
