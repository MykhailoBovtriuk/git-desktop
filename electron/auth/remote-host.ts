import { execFile } from 'child_process';
import { promisify } from 'util';

const run = promisify(execFile);

/**
 * The host a remote URL points at, which is the key everything about
 * authentication hangs off: which provider to offer, which account applies,
 * which credential git will ask for.
 *
 * Both remote forms have to work. `git@host:path` is not a URL — it is scp
 * syntax, and `new URL()` parses it as the "git" scheme with an empty host —
 * so it needs its own branch rather than a lenient parser.
 */

/** scp-like syntax: [user@]host:path, where the part after ":" is not a port. */
const SCP_LIKE = /^(?:[^@/]+@)?([^:/]+):(?!\/)/;

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
 * Hosts are compared, stored and shown, so they need one spelling. Case is
 * folded because DNS is case-insensitive while our lookups are not; a trailing
 * dot is the fully-qualified form of the same name.
 */
function normalize(host: string): string {
  const lower = host.toLowerCase();
  return lower.endsWith('.') ? lower.slice(0, -1) : lower;
}

/** True for a host git can reach over the network — i.e. not a local path. */
export function isNetworkHost(host: string | null): host is string {
  return !!host && host.length > 0 && !host.startsWith('.') && !host.includes('/');
}

/**
 * What an SSH host actually resolves to.
 *
 * People with more than one account on the same service give each a nickname
 * in ~/.ssh/config — `git@github-work:org/repo.git` — and git resolves it
 * before connecting. Taking the nickname at face value means never recognising
 * the service, so the app would silently offer nothing to sign in to.
 *
 * `ssh -G` performs exactly the resolution git relies on and opens no
 * connection. Results are cached: the config does not change mid-session, and
 * this runs on every repository open.
 */
const aliasCache = new Map<string, string>();

export async function resolveSshAlias(host: string): Promise<string> {
  const cached = aliasCache.get(host);
  if (cached !== undefined) return cached;

  let resolved = host;
  try {
    const { stdout } = await run('ssh', ['-G', host]);
    const line = stdout.split('\n').find(l => l.startsWith('hostname '));
    const value = line?.slice('hostname '.length).trim();
    if (value) resolved = value.toLowerCase();
  } catch {
    // No ssh on PATH, or a host it cannot parse: the original is the best
    // answer available, and a wrong guess here is worse than none.
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
