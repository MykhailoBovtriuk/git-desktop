import { execFile } from 'child_process';
import type { RepoIdentity } from '../../src/types';
import { logged, markCurrent } from '../log/git-logger';
import { isRejected } from './http';
import { describeError } from '../../src/lib/error-message';
import { preferredRemote, protocolFromRemoteUrl, resolveRemote } from './remote-host';
import { accountForRepo } from './token-store';
import { credentialHelpersFor, storedCredential } from './git-credentials';
import { appCredentialFor } from './release-git-credential';
import { providerForHost } from './providers/registry';
import { checkSsh, pickSshCommand, sshDestination } from './ssh-identity';

type Profile = Pick<RepoIdentity, 'login' | 'name' | 'avatarDataUrl'>;

const profiles = new Map<string, Profile>();

export function clearIdentityCache(): void {
  profiles.clear();
}

function gitOut(repoPath: string, args: string[]): Promise<string | null> {
  return new Promise(resolve => {
    execFile('git', ['-C', repoPath, ...args], { timeout: 5000 }, (err, stdout) =>
      resolve(err ? null : String(stdout).trim() || null),
    );
  });
}

async function originUrl(repoPath: string): Promise<string | null> {
  const name = preferredRemote(await gitOut(repoPath, ['remote']));
  if (!name) return null;
  return gitOut(repoPath, ['remote', 'get-url', '--push', name]);
}

const nobody = (host: string | null): RepoIdentity => ({
  source: 'none',
  host,
  login: null,
  name: null,
  avatarDataUrl: null,
  ssh: null,
  helpers: [],
  profile: null,
});

export async function resolveIdentity(repoPath: string): Promise<RepoIdentity> {
  const url = await originUrl(repoPath);
  const { host, protocol } = await resolveRemote(url);
  if (!url || !host) return nobody(null);

  const account = await accountForRepo(repoPath);
  if (account?.host === host) {
    return {
      source: 'account',
      host,
      login: account.login,
      name: account.name,
      avatarDataUrl: account.avatarDataUrl,
      ssh: null,
      helpers: [],
      profile: null,
    };
  }
  if (protocol === 'ssh') return sshIdentity(repoPath, url, host);
  if (protocol !== 'https') return nobody(host);
  return systemIdentity(repoPath, url, host);
}

async function sshIdentity(repoPath: string, url: string, host: string): Promise<RepoIdentity> {
  const dest = sshDestination(url);
  if (!dest) return { ...nobody(host), source: 'ssh' };
  const configured = await gitOut(repoPath, ['config', '--get', 'core.sshCommand']);
  const command = pickSshCommand(process.env, configured);
  const ssh = await logged('ssh-check', repoPath, host, () => checkSsh(dest, command), {
    quiet: true,
  });
  return { ...nobody(host), source: 'ssh', login: ssh.login, ssh };
}

function credentialTarget(url: string): { host: string; path: string; username: string | null } {
  const parsed = new URL(url);
  return {
    host: parsed.host.toLowerCase(),
    path: decodeURIComponent(parsed.pathname.replace(/^\/+/, '')),
    username: parsed.username ? decodeURIComponent(parsed.username) : null,
  };
}

async function ownCredential(host: string, repoPath: string | null, url: string | null) {
  const target =
    url && protocolFromRemoteUrl(url) === 'https' ? credentialTarget(url) : { host, path: null };
  const stored = await storedCredential({ ...target, cwd: repoPath ?? undefined });
  if (!stored) return null;
  // The app's own entry for another repository is not this one's login:
  // each repository signs in for itself.
  if (await appCredentialFor(host, stored.username)) return null;
  return { target, stored };
}

/** What git would sign in with for this repository, when the app did not put it there. */
export async function systemCredentialFor(host: string, repoPath: string | null): Promise<boolean> {
  const url = repoPath ? await originUrl(repoPath) : null;
  return (await ownCredential(host, repoPath, url)) !== null;
}

async function systemIdentity(repoPath: string, url: string, host: string): Promise<RepoIdentity> {
  const own = await ownCredential(host, repoPath, url);
  if (!own) return nobody(host);
  const { target, stored } = own;

  const helpers = await credentialHelpersFor(target.host, repoPath);
  const source = helpers.some(h => h.cli === 'gcm') ? 'gcm' : 'system';
  const base: RepoIdentity = { ...nobody(host), source, helpers };
  const provider = providerForHost(host);
  if (!provider) return { ...base, profile: 'unavailable' };

  const key = `${host}\0${stored.username}`;
  const cached = profiles.get(key);
  if (cached) return { ...base, ...cached, profile: 'ok' };
  try {
    const fetched = await provider.fetchAccount(host, stored.password);
    const profile: Profile = {
      login: fetched.login || null,
      name: fetched.name,
      avatarDataUrl: fetched.avatarDataUrl,
    };
    profiles.set(key, profile);
    return { ...base, ...profile, profile: 'ok' };
  } catch (err: unknown) {
    const rejected = isRejected(err);
    markCurrent({
      status: 'warning',
      error: rejected
        ? `${provider.displayName} rejected the credential git has stored for ${host}`
        : `Could not ask ${provider.displayName} who the stored credential belongs to — caused by: ${describeError(err)}`,
    });
    return { ...base, profile: rejected ? 'rejected' : 'unavailable' };
  }
}
