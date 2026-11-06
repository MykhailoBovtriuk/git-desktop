import { describe, it, expect, beforeEach, vi } from 'vitest';

interface Spawn {
  file: string;
  args: string[];
  env: NodeJS.ProcessEnv;
}

const spawns: Spawn[] = [];
let reply: { stdout: string; stderr: string; err: (Error & { killed?: boolean }) | null } = {
  stdout: '',
  stderr: '',
  err: null,
};

vi.mock('child_process', () => ({
  execFile: (
    file: string,
    args: string[],
    options: { env: NodeJS.ProcessEnv },
    cb: (err: Error | null, stdout: string, stderr: string) => void,
  ) => {
    spawns.push({ file, args, env: options.env });
    queueMicrotask(() => cb(reply.err, reply.stdout, reply.stderr));
    return {};
  },
}));

const ssh = await import('../../electron/auth/ssh-identity');

beforeEach(() => {
  spawns.length = 0;
  reply = { stdout: '', stderr: '', err: null };
});

describe('sshDestination', () => {
  it.each([
    ['git@github.com:a/b.git', { user: 'git', host: 'github.com', port: null }],
    ['work-gh:a/b.git', { user: null, host: 'work-gh', port: null }],
    [
      'ssh://git@gitlab.example.org:2222/a/b.git',
      { user: 'git', host: 'gitlab.example.org', port: 2222 },
    ],
    ['git+ssh://git@github.com/a/b.git', { user: 'git', host: 'github.com', port: null }],
    [
      'org@vs-ssh.visualstudio.com:v3/org/p/r',
      { user: 'org', host: 'vs-ssh.visualstudio.com', port: null },
    ],
  ])('reads %s', (url, dest) => {
    expect(ssh.sshDestination(url)).toEqual(dest);
  });

  it.each(['https://github.com/a/b.git', '/srv/repo.git', '-oProxyCommand=x:a/b', 'C:\\repo'])(
    'refuses %s',
    url => {
      expect(ssh.sshDestination(url)).toBeNull();
    },
  );
});

describe('parseSshGreeting', () => {
  it.each([
    [
      "Hi octocat! You've successfully authenticated, but GitHub does not provide shell access.",
      { ok: true, login: 'octocat', reason: 'ok' },
    ],
    ['Welcome to GitLab, @jane.doe!', { ok: true, login: 'jane.doe', reason: 'ok' }],
    [
      'remote: Shell access is not supported.\nshell request failed on channel 0',
      { ok: true, login: null, reason: 'ok' },
    ],
    ['Host key verification failed.', { ok: false, login: null, reason: 'host-key' }],
    [
      'git@github.com: Permission denied (publickey).',
      { ok: false, login: null, reason: 'key-rejected' },
    ],
    [
      'ssh: Could not resolve hostname nope: nodename nor servname provided',
      { ok: false, login: null, reason: 'unreachable' },
    ],
    ['something else', { ok: false, login: null, reason: 'unknown' }],
  ])('reads %s', (text, result) => {
    expect(ssh.parseSshGreeting(text)).toEqual(result);
  });
});

describe('pickSshCommand', () => {
  it('follows the order git uses', () => {
    expect(ssh.pickSshCommand({ GIT_SSH_COMMAND: 'ssh -i k', GIT_SSH: 'plink' }, 'ssh -v')).toEqual(
      { kind: 'shell', command: 'ssh -i k' },
    );
    expect(ssh.pickSshCommand({ GIT_SSH: 'plink' }, 'ssh -i repo-key')).toEqual({
      kind: 'shell',
      command: 'ssh -i repo-key',
    });
    expect(ssh.pickSshCommand({ GIT_SSH: '/opt/ssh' }, null)).toEqual({
      kind: 'program',
      program: '/opt/ssh',
    });
    expect(ssh.pickSshCommand({}, null)).toEqual({ kind: 'program', program: 'ssh' });
  });
});

describe('checkSsh', () => {
  const dest = { user: 'git', host: 'github.com', port: 2222 };

  it('runs ssh in batch mode with the C locale, and takes exit 1 with a greeting as success', async () => {
    reply = {
      stdout: '',
      stderr:
        "Hi octocat! You've successfully authenticated, but GitHub does not provide shell access.",
      err: Object.assign(new Error('exit 1'), { code: 1 }),
    };
    await expect(ssh.checkSsh(dest, { kind: 'program', program: 'ssh' })).resolves.toEqual({
      ok: true,
      login: 'octocat',
      reason: 'ok',
    });
    expect(spawns[0].file).toBe('ssh');
    expect(spawns[0].args).toEqual([
      '-o',
      'BatchMode=yes',
      '-o',
      'ConnectTimeout=8',
      '-T',
      '-p',
      '2222',
      'git@github.com',
    ]);
    expect(spawns[0].env.LC_ALL).toBe('C');
  });

  it.runIf(process.platform !== 'win32')(
    "runs the repository's sshCommand through sh, as git does",
    async () => {
      await ssh.checkSsh(dest, { kind: 'shell', command: 'ssh -i ~/.ssh/work' });
      expect(spawns[0].file).toBe('/bin/sh');
      expect(spawns[0].args.slice(0, 3)).toEqual([
        '-c',
        'ssh -i ~/.ssh/work "$@"',
        'ssh -i ~/.ssh/work',
      ]);
      expect(spawns[0].args.slice(-1)[0]).toBe('git@github.com');
    },
  );

  it('treats a timeout as unreachable', async () => {
    reply = { stdout: '', stderr: '', err: Object.assign(new Error('killed'), { killed: true }) };
    const result = await ssh.checkSsh(dest, { kind: 'program', program: 'ssh' });
    expect(result.reason).toBe('unreachable');
  });
});
