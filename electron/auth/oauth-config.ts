import fs from 'fs';
import path from 'path';
import type { ProviderId } from '../../src/types';

/**
 * The OAuth client ids this build carries, and the two client secrets that
 * cannot be avoided.
 *
 * `tsc` performs no compile-time substitution, so the values are written as
 * JSON beside the compiled main process by `scripts/gen-oauth-config.mjs` and
 * read here at startup. The environment wins over the file so a developer can
 * override a packaged value without rebuilding.
 *
 * GitHub and Bitbucket need a secret because neither offers PKCE to desktop
 * clients; anyone can extract it from an installer, exactly as they can from
 * GitHub Desktop. It is not a password — it is useless without an
 * authorization code the user granted explicitly.
 */
export interface ProviderKeys {
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
  // dist-electron/electron/auth/oauth-config.js → dist-electron/oauth-keys.json
  const file = path.join(__dirname, '..', '..', 'oauth-keys.json');
  try {
    baked = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, string>;
  } catch {
    // Absent in a source checkout that has never been built, and in every test.
    baked = {};
  }
  return baked;
}

/** Exported for tests: lets a suite start from a known state. */
export function resetKeyCache(): void {
  baked = null;
}

function readVar(name: string): string {
  return process.env[name] || bakedKeys()[name] || '';
}

/**
 * Keys for a provider, or null when this build has none. Self-hosted providers
 * always return null here: their app is registered on the user's own instance,
 * so the client id arrives with the server address instead.
 */
export function keysFor(id: ProviderId): ProviderKeys | null {
  const names = ENV_NAMES[id];
  if (!names) return null;
  const clientId = readVar(names.id);
  if (!clientId) return null;
  const clientSecret = names.secret ? readVar(names.secret) : '';
  // A provider that needs a secret and has none cannot complete the exchange —
  // offering it in the picker would be a dead end.
  if (names.secret && !clientSecret) return null;
  return { clientId, clientSecret: clientSecret || null };
}

/** The redirect target registered with every provider. */
export const REDIRECT_URI = 'git-desktop-auth://oauth';
export const PROTOCOL_SCHEME = 'git-desktop-auth';
