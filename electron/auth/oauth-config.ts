import fs from 'fs';
import path from 'path';
import type { ProviderId } from '../../src/types';

/**
 * OAuth client ids and secrets from `scripts/gen-oauth-config.mjs` output; env
 * overrides. GitHub and Bitbucket need a secret: no PKCE for desktop clients.
 */
interface ProviderKeys {
  clientId: string;
  clientSecret: string | null;
}

const ENV_NAMES: Partial<Record<ProviderId, { id: string; secret?: string }>> = {
  github: { id: 'OAUTH_GITHUB_ID', secret: 'OAUTH_GITHUB_SECRET' },
  gitlab: { id: 'OAUTH_GITLAB_ID' },
  'azure-devops': { id: 'OAUTH_AZURE_ID' },
  bitbucket: { id: 'OAUTH_BITBUCKET_ID', secret: 'OAUTH_BITBUCKET_SECRET' },
  gitea: { id: 'OAUTH_GITEA_ID' },
};

let baked: Record<string, string> | null = null;

function bakedKeys(): Record<string, string> {
  if (baked) return baked;
  const file = path.join(__dirname, '..', '..', 'oauth-keys.json');
  try {
    baked = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, string>;
  } catch {
    baked = {};
  }
  return baked;
}

export function resetKeyCache(): void {
  baked = null;
}

function readVar(name: string): string {
  return process.env[name] || bakedKeys()[name] || '';
}

export function keysFor(id: ProviderId): ProviderKeys | null {
  const names = ENV_NAMES[id];
  if (!names) return null;
  const clientId = readVar(names.id);
  if (!clientId) return null;
  const clientSecret = names.secret ? readVar(names.secret) : '';
  if (names.secret && !clientSecret) return null;
  return { clientId, clientSecret: clientSecret || null };
}

export const REDIRECT_URI = 'git-desktop-auth://oauth';
export const PROTOCOL_SCHEME = 'git-desktop-auth';
