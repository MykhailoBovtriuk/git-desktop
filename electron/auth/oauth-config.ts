import fs from 'fs';
import path from 'path';
import type { ProviderId } from '../../src/types';

interface ProviderKeys {
  clientId: string;
  clientSecret: string | null;
}

const ENV_NAMES: Partial<Record<ProviderId, { id: string; secret?: string }>> = {
  github: { id: 'OAUTH_GITHUB_ID', secret: 'OAUTH_GITHUB_SECRET' },
  gitlab: { id: 'OAUTH_GITLAB_ID' },
  'azure-devops': { id: 'OAUTH_AZURE_ID' },
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

const CLIENT_ID_RE = /^[A-Za-z0-9._-]{1,64}$/;

// Only a build with the full baked keys signs in with our own app; otherwise the
// token came from an OAuth app the user registered, whose id we don't know here.
export function githubOrgAccessUrl(): string {
  const id = keysFor('github')?.clientId;
  return id && CLIENT_ID_RE.test(id)
    ? `https://github.com/settings/connections/applications/${id}`
    : 'https://github.com/settings/applications';
}
