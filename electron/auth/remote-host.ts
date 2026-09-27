import { execFile } from 'child_process';
import { promisify } from 'util';

const run = promisify(execFile);

/**
 * The host a remote URL points at. `git@host:path` is scp syntax, not a URL, so
 * it gets its own branch.
 */

/**
 * scp-like syntax: [user@]host:path, where the part after ":" is not a port.
 * A slash of either kind after ":" rules out a Windows drive path (`C:\repo`).
 */
const SCP_LIKE = /^(?:[^@/]+@)?([^:/]+):(?![\\/])/;

export function hostFromRemoteUrl(remoteUrl: string | null | undefined): string | null {
  if (!remoteUrl) return null;
  const raw = remoteUrl.trim();
  if (!raw) return null;

  const scp = SCP_LIKE.exec(raw);
  if (scp && !raw.includes('://')) {
    return normalize(scp[1]);
  }

  try {
    const url = new URL(raw);
    return url.hostname ? normalize(url.hostname) : null;
  } catch {
    return null;
  }
}

/**
 * One spelling per host: lowercase (DNS is case-insensitive) and without the
 * trailing dot.
 */
function normalize(host: string): string {
  const lower = host.toLowerCase();
  return lower.endsWith('.') ? lower.slice(0, -1) : lower;
}

/**
 * How git authenticates to a remote. An ssh remote uses a key, so a sign-in
 * offer is pointless there.
 */
export type RemoteProtocol = 'ssh' | 'https' | 'other';

export function protocolFromRemoteUrl(remoteUrl: string | null | undefined): RemoteProtocol | null {
  if (!remoteUrl) return null;
  const raw = remoteUrl.trim();
  if (!raw) return null;
  if (!raw.includes('://')) return SCP_LIKE.test(raw) ? 'ssh' : 'other';
  const scheme = raw.slice(0, raw.indexOf('://')).toLowerCase();
  if (scheme === 'ssh' || scheme === 'git+ssh') return 'ssh';
  if (scheme === 'https' || scheme === 'http') return 'https';
  return 'other';
}

/** True for a host git can reach over the network — i.e. not a local path. */
export function isNetworkHost(host: string | null): host is string {
  return !!host && host.length > 0 && !host.startsWith('.') && !host.includes('/');
}

/**
 * What an SSH host alias from ~/.ssh/config resolves to, via `ssh -G` (no
 * connection). Cached: the config does not change mid-session.
 */
const aliasCache = new Map<string, string>();

async function resolveSshAlias(host: string): Promise<string> {
  const cached = aliasCache.get(host);
  if (cached !== undefined) return cached;

  let resolved = host;
  try {
    const { stdout } = await run('ssh', ['-G', host], { timeout: 3000 });
    const line = stdout.split('\n').find(l => l.startsWith('hostname '));
    const value = line?.slice('hostname '.length).trim();
    if (value) resolved = value.toLowerCase();
  } catch {
    // No ssh on PATH, a host it cannot parse, or no answer in time: the
    // original is the best answer available, and a wrong guess is worse.
  }
  aliasCache.set(host, resolved);
  return resolved;
}

/** Exported for tests: lets a suite start from a known state. */
export function resetAliasCache(): void {
  aliasCache.clear();
}

/**
 * The host to treat a remote as belonging to, with SSH nicknames resolved.
 * Returns null for a remote git would not reach over the network.
 */
export async function resolveRemoteHost(
  remoteUrl: string | null | undefined,
): Promise<string | null> {
  const host = hostFromRemoteUrl(remoteUrl);
  if (!isNetworkHost(host)) return null;
  // A name with a dot is already a hostname; only a bare nickname needs asking.
  const resolved = host.includes('.') ? host : await resolveSshAlias(host);
  return isNetworkHost(resolved) && resolved.includes('.') ? resolved : null;
}

/** The host and the protocol together: both answers come from one URL. */
export async function resolveRemote(
  remoteUrl: string | null | undefined,
): Promise<{ host: string | null; protocol: RemoteProtocol | null }> {
  return {
    host: await resolveRemoteHost(remoteUrl),
    protocol: protocolFromRemoteUrl(remoteUrl),
  };
}

/**
 * The remote URL of a repository, preferring `origin`. Read here, not taken
 * from the renderer, since it is passed to `git ls-remote`.
 */
export async function originUrlFor(repoRoot: string): Promise<string | null> {
  try {
    const { stdout } = await run('git', ['-C', repoRoot, 'remote']);
    const names = stdout
      .split('\n')
      .map(n => n.trim())
      .filter(Boolean);
    const chosen = names.includes('origin') ? 'origin' : names[0];
    if (!chosen) return null;
    const { stdout: url } = await run('git', [
      '-C',
      repoRoot,
      'config',
      '--get',
      `remote.${chosen}.url`,
    ]);
    return url.trim() || null;
  } catch {
    // Not a repository, or a remote with no URL configured.
    return null;
  }
}
