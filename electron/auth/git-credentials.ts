import { execFile } from 'child_process';
import os from 'os';
import type { CredentialHelperEntry, ProviderAccount } from '../../src/types';
import { providerById } from './providers/registry';

/**
 * Values we are willing to write, per platform. A credential helper is a
 * command git executes, so this is an allowlist rather than a free-text field.
 */
const ALLOWED_HELPERS: Record<string, string[]> = {
  darwin: ['osxkeychain'],
  win32: ['manager', 'manager-core'],
  linux: ['libsecret', 'cache --timeout=3600'],
};

export function allowedHelpers(platform: string = process.platform): string[] {
  return ALLOWED_HELPERS[platform] ?? [];
}

function run(args: string[], stdin?: string, env?: NodeJS.ProcessEnv): Promise<string> {
  return new Promise((resolve, reject) => {
    const options = { env: env ?? process.env, cwd: os.homedir() };
    const child = execFile('git', args, options, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
    if (stdin !== undefined) {
      child.stdin?.end(stdin);
    }
  });
}

/**
 * Make sure git has a credential helper for this host; without one `git
 * credential approve` silently stores nothing. Any scope counts, the system
 * one included, and so does a helper scoped to the host's URL: the global
 * config is written only when git would otherwise have nowhere to keep a
 * token. Returns the helper, or null if none is trusted.
 */
export async function ensureCredentialHelper(host?: string): Promise<string | null> {
  const lookup = host
    ? ['config', '--get-urlmatch', 'credential.helper', `https://${host}`]
    : ['config', '--get', 'credential.helper'];
  const existing = await run(lookup)
    .then(out => out.trim().split('\n').pop()?.trim() ?? '')
    .catch(() => '');
  if (existing) return existing;

  const helper = allowedHelpers()[0];
  if (!helper) return null;
  // One argv entry, even for "cache --timeout=3600": execFile bypasses the
  // shell, so splitting would turn --timeout into a flag for git config itself.
  await run(['config', '--global', 'credential.helper', helper]);
  return helper;
}

export function gitUsernameFor(account: ProviderAccount): string {
  const provider = providerById(account.providerId);
  return provider?.gitUsername?.(account) ?? account.login;
}

function describe(host: string, username: string, password?: string): string {
  const lines = [`protocol=https`, `host=${host}`, `username=${username}`];
  if (password !== undefined) lines.push(`password=${password}`);
  return lines.join('\n') + '\n\n';
}

/**
 * Hand the token to the system credential store so plain `git push` works. Sent
 * over stdin, not argv, which `ps` exposes.
 */
export async function approveCredentials(
  host: string,
  username: string,
  token: string,
): Promise<void> {
  await ensureCredentialHelper(host);
  await run(['credential', 'approve'], describe(host, username, token));
}

async function lookupStored(host: string): Promise<{ username: string; password: string } | null> {
  // GCM_INTERACTIVE: Git Credential Manager would otherwise open its own
  // sign-in window for what is meant to be a silent question.
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_TERMINAL_PROMPT: '0',
    GCM_INTERACTIVE: 'never',
  };
  delete env.GIT_ASKPASS;
  delete env.SSH_ASKPASS;
  const out = await run(['credential', 'fill'], `protocol=https\nhost=${host}\n\n`, env).catch(
    () => '',
  );
  const password = /^password=(.+)$/m.exec(out)?.[1];
  if (!password) return null;
  return { username: /^username=(.*)$/m.exec(out)?.[1] ?? '', password };
}

export async function storedUsername(host: string): Promise<string | null> {
  return (await lookupStored(host))?.username ?? null;
}

const usernameKey = (host: string) => `credential.https://${host}.username`;

/**
 * Tie a repository to a login: its own `.git/config` names the username, so
 * git there (the app, or a terminal in that folder) asks the credential store
 * for this user's token and no other. Outside the folder nothing changes.
 */
export async function bindRepoUsername(
  repoPath: string,
  host: string,
  username: string,
): Promise<void> {
  await run(['-C', repoPath, 'config', '--local', usernameKey(host), username]);
}

export async function unbindRepoUsername(repoPath: string, host: string): Promise<void> {
  await run(['-C', repoPath, 'config', '--local', '--unset-all', usernameKey(host)]).catch(
    () => {},
  );
}

export async function forgetStoredCredential(host: string): Promise<boolean> {
  const stored = await lookupStored(host);
  if (!stored) return false;
  await run(['credential', 'reject'], describe(host, stored.username, stored.password));
  return true;
}

export async function rejectCredentials(host: string, username: string): Promise<void> {
  await run(['credential', 'reject'], describe(host, username)).catch(() => {});
}

function helperCli(helper: string): CredentialHelperEntry['cli'] {
  if (/\bgh(\.exe)?["']?\s+auth\s+git-credential\b/.test(helper)) return 'gh';
  if (/\bglab(\.exe)?["']?\s+auth\s+git-credential\b/.test(helper)) return 'glab';
  if (/(^|[\\/\s])(git-credential-)?manager(-core)?(\.exe)?$/.test(helper.trim())) return 'gcm';
  return null;
}

const HELPER_KEY = /^credential\.(?:(.+)\.)?helper$/i;

export async function listCredentialHelpers(): Promise<CredentialHelperEntry[]> {
  const out = await run([
    'config',
    '--show-scope',
    '--get-regexp',
    '^credential\\..*helper$',
  ]).catch(() => '');
  const entries: CredentialHelperEntry[] = [];
  for (const line of out.split('\n')) {
    const match = /^(\w+)\t(\S+)\s?(.*)$/.exec(line);
    if (!match) continue;
    const [, rawScope, key, value] = match;
    // Apple's git reports its bundled defaults as "unknown"; they act as system.
    const scope = rawScope === 'global' ? 'global' : rawScope === 'local' ? 'local' : 'system';
    const url = HELPER_KEY.exec(key)?.[1] ?? null;
    const helper = value.trim();
    // An empty value resets the list before it, rather than naming a helper.
    if (!helper) {
      for (let i = entries.length - 1; i >= 0; i--) {
        if (entries[i].url === url) entries.splice(i, 1);
      }
      continue;
    }
    entries.push({
      url,
      helper,
      scope,
      cli: helperCli(helper),
    });
  }
  return entries;
}
