import { execFile } from 'child_process';
import type { SshCheck, SshCheckReason } from '../../src/types';
import { markCurrent, recordCommand } from '../log/git-logger';

export interface SshDestination {
  user: string | null;
  host: string;
  port: number | null;
}

const SCP_LIKE = /^(?:([^@/]+)@)?([^:/]+):(?![\\/])/;
// Both end up as ssh arguments, and on Windows inside a shell line: a strict
// charset keeps either from turning into an option (`-oProxyCommand=…`) or a command.
const SAFE_USER = /^[A-Za-z0-9_][A-Za-z0-9._-]*$/;
const SAFE_HOST = /^(?:[A-Za-z0-9_][A-Za-z0-9._-]*|[0-9A-Fa-f:.]+)$/;

export function sshDestination(remoteUrl: string | null | undefined): SshDestination | null {
  const raw = remoteUrl?.trim();
  if (!raw) return null;
  let user: string | null;
  let host: string;
  let port: number | null = null;
  if (raw.includes('://')) {
    const scheme = raw.slice(0, raw.indexOf('://')).toLowerCase();
    if (scheme !== 'ssh' && scheme !== 'git+ssh') return null;
    let url: URL;
    try {
      url = new URL(raw.replace(/^git\+ssh:/i, 'ssh:'));
    } catch {
      return null;
    }
    user = url.username ? decodeURIComponent(url.username) : null;
    host = url.hostname.replace(/^\[|\]$/g, '');
    port = url.port ? Number(url.port) : null;
  } else {
    const m = SCP_LIKE.exec(raw);
    if (!m) return null;
    user = m[1] ?? null;
    host = m[2];
  }
  if (!host || !SAFE_HOST.test(host)) return null;
  if (user !== null && !SAFE_USER.test(user)) return null;
  return { user, host, port };
}

export type SshCommand = { kind: 'program'; program: string } | { kind: 'shell'; command: string };

/** The order git itself uses: GIT_SSH_COMMAND, core.sshCommand, GIT_SSH, then plain ssh. */
export function pickSshCommand(
  env: NodeJS.ProcessEnv,
  configuredCommand: string | null,
): SshCommand {
  const fromEnv = env.GIT_SSH_COMMAND?.trim();
  if (fromEnv) return { kind: 'shell', command: fromEnv };
  if (configuredCommand?.trim()) return { kind: 'shell', command: configuredCommand.trim() };
  const program = env.GIT_SSH?.trim();
  if (program) return { kind: 'program', program };
  return { kind: 'program', program: 'ssh' };
}

export function sshArgs(dest: SshDestination): string[] {
  const args = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', '-T'];
  if (dest.port) args.push('-p', String(dest.port));
  args.push(dest.user ? `${dest.user}@${dest.host}` : dest.host);
  return args;
}

export function parseSshGreeting(output: string): SshCheck {
  const github = /Hi ([A-Za-z0-9-]+)! You've successfully authenticated/.exec(output);
  if (github) return { ok: true, login: github[1], reason: 'ok' };
  const gitlab = /Welcome to GitLab, @([^\s!]+)!/.exec(output);
  if (gitlab) return { ok: true, login: gitlab[1], reason: 'ok' };
  // Azure DevOps accepts the key and then refuses a shell, without naming the user.
  if (/Shell access is not supported/i.test(output)) return { ok: true, login: null, reason: 'ok' };
  if (/Host key verification failed/i.test(output)) return fail('host-key');
  if (/Permission denied \([^)]*publickey/i.test(output)) return fail('key-rejected');
  if (
    /Could not resolve hostname|Connection timed out|Connection refused|Network is unreachable|Operation timed out|No route to host/i.test(
      output,
    )
  ) {
    return fail('unreachable');
  }
  return fail('unknown');
}

function fail(reason: SshCheckReason): SshCheck {
  return { ok: false, login: null, reason };
}

const REASON_TEXT: Record<Exclude<SshCheckReason, 'ok'>, string> = {
  'host-key': 'The host key of this server is not trusted yet',
  'key-rejected': 'The server did not accept any SSH key',
  unreachable: 'Could not reach the server over SSH',
  unknown: 'Could not tell who the SSH key belongs to',
};

interface Spawned {
  stdout: string;
  stderr: string;
  killed: boolean;
}

function spawnSsh(command: SshCommand, args: string[]): Promise<Spawned> {
  const env = { ...process.env, LC_ALL: 'C' };
  const options = { env, timeout: 10_000, windowsHide: true };
  return new Promise(resolve => {
    const done = (err: (Error & { killed?: boolean }) | null, stdout: string, stderr: string) =>
      resolve({
        stdout: String(stdout ?? ''),
        stderr: String(stderr ?? ''),
        killed: !!err?.killed,
      });
    if (command.kind === 'program') {
      execFile(command.program, args, options, done);
    } else if (process.platform === 'win32') {
      // Arguments passed the SAFE_* checks, so quoting them is enough for cmd.
      const line = [command.command, ...args.map(a => `"${a}"`)].join(' ');
      execFile(line, [], { ...options, shell: true }, done);
    } else {
      // Exactly how git runs core.sshCommand: through sh, with the arguments as "$@".
      execFile(
        '/bin/sh',
        ['-c', `${command.command} "$@"`, command.command, ...args],
        options,
        done,
      );
    }
  });
}

/**
 * `ssh -T` against the address git would connect to. An ssh greeting goes to
 * stderr and GitHub exits 1 even on success, so the text decides, not the code.
 */
export async function checkSsh(dest: SshDestination, command: SshCommand): Promise<SshCheck> {
  const args = sshArgs(dest);
  const argv = command.kind === 'program' ? [command.program, ...args] : [command.command, ...args];
  const { stdout, stderr, killed } = await spawnSsh(command, args);
  recordCommand(argv, stdout, stderr);
  const result = killed ? fail('unreachable') : parseSshGreeting(`${stdout}\n${stderr}`);
  if (result.reason !== 'ok') {
    markCurrent({ status: 'warning', error: REASON_TEXT[result.reason] });
  }
  return result;
}
