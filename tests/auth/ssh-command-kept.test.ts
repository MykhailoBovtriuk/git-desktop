import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

vi.mock('../../electron/auth/token-store', () => ({
  accountForRepo: async () => null,
  credentialsOnHost: async () => [],
}));

const { stripLegacyProfileKeys } = await import('../../electron/auth/legacy-cleanup');
const { resolveIdentity } = await import('../../electron/auth/repo-identity');

describe.runIf(process.platform !== 'win32')("a repository's own core.sshCommand", () => {
  let dir: string;

  beforeEach(() => {
    vi.stubEnv('GIT_SSH_COMMAND', '');
    vi.stubEnv('GIT_SSH', '');
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-sshcmd-'));
    const fake = path.join(dir, 'fake-ssh');
    fs.writeFileSync(
      fake,
      `#!/bin/sh\necho "Hi tester! You've successfully authenticated, args: $*" >&2\nexit 1\n`,
      { mode: 0o755 },
    );
    const repo = path.join(dir, 'repo');
    fs.mkdirSync(repo);
    const git = (...args: string[]) => execFileSync('git', args, { cwd: repo });
    git('init');
    git('remote', 'add', 'origin', 'git@github.com:a/b.git');
    git('config', '--local', 'core.sshCommand', fake);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('survives opening the repository and runs the ssh check', async () => {
    const repo = path.join(dir, 'repo');
    await stripLegacyProfileKeys(repo);
    const identity = await resolveIdentity(repo);
    expect(identity).toMatchObject({ source: 'ssh', login: 'tester', ssh: { ok: true } });
  });
});
