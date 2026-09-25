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

/**
 * How git will authenticate to a remote — which decides whether signing in can
 * help at all.
 *
 * An ssh remote never carries a token: it authenticates with a key, so both the
 * sign-in offer and the stored credential are beside the point there. Treating
 * every remote the same is what had the app asking people to sign in to
 * repositories where signing in changes nothing.
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

async function resolveSshAlias(host: string): Promise<string> {
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
 * The remote URL of a repository on disk, preferring `origin`.
 *
 * Read here rather than taken from the renderer: this address is handed to
 * `git ls-remote`, and a value that travelled through the UI is a value
 * somebody could have changed on the way.
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
