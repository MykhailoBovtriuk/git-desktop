import { execFile } from 'child_process';
import { promisify } from 'util';
import { gitConfigGet, runGit } from '../git/exec';
import type { RemoteProtocol } from '../../src/types';

const run = promisify(execFile);

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

function normalize(host: string): string {
  const lower = host.toLowerCase();
  return lower.endsWith('.') ? lower.slice(0, -1) : lower;
}

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

export function httpsUrlFromSshRemote(
  remoteUrl: string | null | undefined,
  host: string,
): string | null {
  if (protocolFromRemoteUrl(remoteUrl) !== 'ssh') return null;
  const raw = remoteUrl!.trim();
  let repoPath: string;
  if (raw.includes('://')) {
    try {
      repoPath = new URL(raw).pathname;
    } catch {
      return null;
    }
  } else {
    repoPath = raw.slice(SCP_LIKE.exec(raw)![0].length);
  }
  repoPath = repoPath.replace(/^\/+/, '');
  // `~user/repo` is relative to a home directory, which https has no notion of.
  if (!repoPath || repoPath.startsWith('~')) return null;
  return `https://${host}/${repoPath}`;
}

export function sshUrlFromHttpsRemote(remoteUrl: string | null | undefined): string | null {
  if (protocolFromRemoteUrl(remoteUrl) !== 'https') return null;
  let url: URL;
  try {
    url = new URL(remoteUrl!.trim());
  } catch {
    return null;
  }
  const repoPath = url.pathname.replace(/^\/+/, '');
  if (!url.hostname || !repoPath) return null;
  return `git@${url.hostname}:${repoPath}`;
}

export function isNetworkHost(host: string | null): host is string {
  return !!host && host.length > 0 && !host.startsWith('.') && !host.includes('/');
}

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
  } catch {}
  aliasCache.set(host, resolved);
  return resolved;
}

export function resetAliasCache(): void {
  aliasCache.clear();
}

export async function resolveRemoteHost(
  remoteUrl: string | null | undefined,
): Promise<string | null> {
  const host = hostFromRemoteUrl(remoteUrl);
  if (!isNetworkHost(host)) return null;
  const resolved = host.includes('.') ? host : await resolveSshAlias(host);
  return isNetworkHost(resolved) && resolved.includes('.') ? resolved : null;
}

export interface ResolvedRemote {
  url: string | null;
  host: string | null;
  protocol: RemoteProtocol | null;
}

export async function resolveRemote(remoteUrl: string | null | undefined): Promise<ResolvedRemote> {
  return {
    url: remoteUrl?.trim() || null,
    host: await resolveRemoteHost(remoteUrl),
    protocol: protocolFromRemoteUrl(remoteUrl),
  };
}

// Read here, not taken from the renderer, since it is passed to `git ls-remote`.
export async function originUrlFor(repoRoot: string): Promise<string | null> {
  try {
    const names = (await runGit(['-C', repoRoot, 'remote']))
      .split('\n')
      .map(n => n.trim())
      .filter(Boolean);
    const chosen = names.includes('origin') ? 'origin' : names[0];
    if (!chosen) return null;
    return (await gitConfigGet({ kind: 'effective', repoRoot }, `remote.${chosen}.url`)) || null;
  } catch {
    return null;
  }
}
