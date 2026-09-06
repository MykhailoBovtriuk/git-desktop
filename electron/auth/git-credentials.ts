import { execFile } from 'child_process';
import type { ProviderAccount } from '../../src/types';
import { providerById } from './providers/registry';

/**
 * Values we are willing to write, per platform. A credential helper is a
 * command git executes, so this is an allowlist rather than a free-text field.
 * Carried over unchanged from the settings screen this replaced.
 */
const ALLOWED_HELPERS: Record<string, string[]> = {
  darwin: ['osxkeychain'],
  win32: ['manager', 'manager-core'],
  linux: ['libsecret', 'cache --timeout=3600'],
};

export function allowedHelpers(platform: string = process.platform): string[] {
  return ALLOWED_HELPERS[platform] ?? [];
}

function run(args: string[], stdin?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile('git', args, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
    if (stdin !== undefined) {
      child.stdin?.end(stdin);
    }
  });
}

/**
 * Make sure git has somewhere to keep credentials.
 *
 * Without a configured helper, `git credential approve` succeeds and stores
 * nothing — a silent no-op that would leave every push failing after an
 * apparently successful sign-in. Returns the helper in effect, or null when the
 * platform offers none we trust.
 */
export async function ensureCredentialHelper(): Promise<string | null> {
  const existing = await run(['config', '--global', '--get', 'credential.helper'])
    .then(out => out.trim())
    .catch(() => '');
  if (existing) return existing;

  const helper = allowedHelpers()[0];
  if (!helper) return null;
  // One argv entry, even for "cache --timeout=3600": execFile bypasses the
  // shell, so splitting would turn --timeout into a flag for git config itself.
  await run(['config', '--global', 'credential.helper', helper]);
  return helper;
}

/**
 * The username git should send with the token. Azure DevOps ignores it and
 * reads the token from the password field; everyone else wants the login.
 */
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
 * Hand the token to the system credential store, so plain `git push`
 * authenticates on its own.
 *
 * The token goes in over stdin rather than argv: an argument list is visible to
 * every process on the machine via `ps`.
 */
export async function approveCredentials(
  host: string,
  username: string,
  token: string,
): Promise<void> {
  await ensureCredentialHelper();
  await run(['credential', 'approve'], describe(host, username, token));
}

/** Forget a stored credential. Best effort: a helper may have nothing to erase. */
export async function rejectCredentials(host: string, username: string): Promise<void> {
  await run(['credential', 'reject'], describe(host, username)).catch(() => {});
}
