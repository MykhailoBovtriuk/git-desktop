import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import { GitContext } from './context';
import { getRemoteUrl } from './remote';

const run = promisify(execFile);

export interface AuthStatus {
  remoteUrl: string | null;
  isHttps: boolean;
  credentialHelper: string | null;
  signingReady: boolean;
  sshSupportsKeychain: boolean;
}

/**
 * Values we are willing to write, per platform. A credential helper is a command
 * git executes, so this is an allowlist rather than a free-text field — the
 * renderer must never be able to name an arbitrary program here.
 */
const ALLOWED_HELPERS: Record<string, string[]> = {
  darwin: ['osxkeychain'],
  win32: ['manager', 'manager-core'],
  linux: ['libsecret', 'cache --timeout=3600'],
};

export function allowedHelpers(platform: string = process.platform): string[] {
  return ALLOWED_HELPERS[platform] ?? [];
}

/**
 * `UseKeychain` exists only in Apple's OpenSSH build. A macOS user running the
 * Homebrew build gets `Bad configuration option: usekeychain`, which would break
 * every network operation — so probe instead of assuming, and cache the answer.
 * `-G` only computes the effective config; it opens no connection.
 */
let keychainProbe: Promise<boolean> | null = null;
export function sshSupportsUseKeychain(): Promise<boolean> {
  if (!keychainProbe) {
    keychainProbe = run('ssh', ['-o', 'UseKeychain=yes', '-G', 'localhost'])
      .then(() => true)
      .catch(() => false);
  }
  return keychainProbe;
}

/** Exported for tests: lets a suite start from a known state. */
export function resetKeychainProbe(): void {
  keychainProbe = null;
}

async function readConfig(ctx: GitContext, key: string): Promise<string | null> {
  try {
    if (ctx.getRepoPath()) {
      const out = await ctx.ensureRepo().raw(['config', '--get', key]);
      return out.trim() || null;
    }
    const { stdout } = await run('git', ['config', '--global', '--get', key]);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

async function isSigningReady(ctx: GitContext): Promise<boolean> {
  const [signingKey, format, enabled] = await Promise.all([
    readConfig(ctx, 'user.signingkey'),
    readConfig(ctx, 'gpg.format'),
    readConfig(ctx, 'commit.gpgsign'),
  ]);
  if (enabled !== 'true' || format !== 'ssh' || !signingKey) return false;
  return fs
    .stat(signingKey)
    .then(s => s.isFile())
    .catch(() => false);
}

export async function getAuthStatus(ctx: GitContext): Promise<AuthStatus> {
  const hasRepo = !!ctx.getRepoPath();
  const remoteUrl = hasRepo ? await getRemoteUrl(ctx).catch(() => null) : null;
  const [credentialHelper, signingReady, sshSupportsKeychain] = await Promise.all([
    readConfig(ctx, 'credential.helper'),
    hasRepo ? isSigningReady(ctx) : Promise.resolve(false),
    sshSupportsUseKeychain(),
  ]);

  return {
    remoteUrl,
    isHttps: !!remoteUrl && /^https?:\/\//i.test(remoteUrl),
    credentialHelper,
    signingReady,
    sshSupportsKeychain,
  };
}

export async function setCredentialHelper(value: string): Promise<string> {
  if (!allowedHelpers().includes(value)) {
    throw new Error(`Unsupported credential helper: ${value}`);
  }
  // One argv entry, even for "cache --timeout=3600": execFile bypasses the
  // shell, so splitting would turn --timeout into a flag for git config itself.
  await run('git', ['config', '--global', 'credential.helper', value]);
  return value;
}
