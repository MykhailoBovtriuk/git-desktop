import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { GitContext } from './context';
import type { GitIdentity, GitProfile } from '../../src/types';

// Every config key this feature is allowed to touch. `core.sshCommand` in
// particular is executed by git, so its value is assembled here from a
// validated path and never accepted verbatim from the renderer.
const PROFILE_KEYS = [
  'user.name',
  'user.email',
  'core.sshCommand',
  'user.signingkey',
  'gpg.format',
  'commit.gpgsign',
] as const;

// Backslashes are excluded on purpose: they are path separators on Windows.
// The rest are shell metacharacters that could break out of `core.sshCommand`.
const UNSAFE_PATH_CHARS = /["'`$%;&|<>\r\n\0]/;

export function expandHome(input: string): string {
  if (input === '~') return os.homedir();
  if (input.startsWith('~/') || input.startsWith('~\\')) {
    return path.join(os.homedir(), input.slice(2));
  }
  return input;
}

export async function resolveSshKeyPath(input: string): Promise<string> {
  const expanded = expandHome(input.trim());
  if (!expanded) throw new Error('SSH key path is empty');
  if (UNSAFE_PATH_CHARS.test(expanded)) {
    throw new Error('SSH key path contains unsupported characters');
  }
  if (!path.isAbsolute(expanded)) {
    throw new Error('SSH key path must be absolute');
  }
  const stat = await fs.stat(expanded).catch(() => null);
  if (!stat) throw new Error(`SSH key not found: ${expanded}`);
  if (!stat.isFile()) throw new Error(`SSH key is not a file: ${expanded}`);
  return expanded;
}

export function buildSshCommand(keyPath: string): string {
  // IdentitiesOnly stops ssh-agent from silently offering a different key,
  // which would defeat the whole point of picking a profile.
  return `ssh -i "${keyPath}" -o IdentitiesOnly=yes`;
}

export function parseSshKeyPath(sshCommand: string | null): string | null {
  if (!sshCommand) return null;
  return /-i\s+"([^"]+)"/.exec(sshCommand)?.[1] ?? /-i\s+(\S+)/.exec(sshCommand)?.[1] ?? null;
}

async function getLocal(ctx: GitContext, key: string): Promise<string | null> {
  try {
    const out = await ctx.ensureRepo().raw(['config', '--local', '--get', key]);
    return out.trim() || null;
  } catch {
    // git exits non-zero when the key is simply absent.
    return null;
  }
}

async function setLocal(ctx: GitContext, key: string, value: string): Promise<void> {
  await ctx.ensureRepo().raw(['config', '--local', key, value]);
}

async function unsetLocal(ctx: GitContext, key: string): Promise<void> {
  try {
    await ctx.ensureRepo().raw(['config', '--local', '--unset', key]);
  } catch {
    // Exit code 5 means "was not set" — the desired end state either way.
  }
}

export async function getIdentity(ctx: GitContext): Promise<GitIdentity> {
  const [name, email, sshCommand, signingKey, gpgsign] = await Promise.all([
    getLocal(ctx, 'user.name'),
    getLocal(ctx, 'user.email'),
    getLocal(ctx, 'core.sshCommand'),
    getLocal(ctx, 'user.signingkey'),
    getLocal(ctx, 'commit.gpgsign'),
  ]);
  return {
    name,
    email,
    sshKeyPath: parseSshKeyPath(sshCommand),
    signingKey,
    signCommits: gpgsign === 'true',
  };
}

export async function applyProfile(ctx: GitContext, profile: GitProfile): Promise<GitIdentity> {
  await setLocal(ctx, 'user.name', profile.name);
  await setLocal(ctx, 'user.email', profile.email);

  const keyPath = profile.sshKeyPath ? await resolveSshKeyPath(profile.sshKeyPath) : null;

  if (keyPath) {
    await setLocal(ctx, 'core.sshCommand', buildSshCommand(keyPath));
  } else {
    await unsetLocal(ctx, 'core.sshCommand');
  }

  if (profile.signCommits) {
    if (!keyPath) throw new Error('Signing commits requires an SSH key');
    // git wants the public half; fall back to the private path when there is
    // no sibling .pub, which is what ssh-keygen produces by default.
    const pub = `${keyPath}.pub`;
    const hasPub = await fs
      .stat(pub)
      .then(s => s.isFile())
      .catch(() => false);
    await setLocal(ctx, 'user.signingkey', hasPub ? pub : keyPath);
    await setLocal(ctx, 'gpg.format', 'ssh');
    await setLocal(ctx, 'commit.gpgsign', 'true');
  } else {
    await unsetLocal(ctx, 'user.signingkey');
    await unsetLocal(ctx, 'gpg.format');
    await unsetLocal(ctx, 'commit.gpgsign');
  }

  return getIdentity(ctx);
}

export async function clearProfile(ctx: GitContext): Promise<GitIdentity> {
  for (const key of PROFILE_KEYS) {
    await unsetLocal(ctx, key);
  }
  return getIdentity(ctx);
}
