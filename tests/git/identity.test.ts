import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { GitService } from '../../electron/git-service';

let tmpDir: string;
let home: string;
let git: GitService;

const run = (cmd: string, cwd = tmpDir) => execSync(cmd, { cwd });

let realHome: string | undefined;

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'git-desktop-home-'));
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'git-desktop-ident-'));

  // GitService spawns git through simple-git with the process environment, and
  // os.homedir() reads $HOME too — so pointing HOME at a scratch directory is
  // what keeps these assertions off the developer's real global git config.
  realHome = process.env.HOME;
  process.env.HOME = home;
  process.env.GIT_CONFIG_NOSYSTEM = '1';

  run('git init', tmpDir);
  git = new GitService();
});

afterEach(() => {
  if (realHome === undefined) delete process.env.HOME;
  else process.env.HOME = realHome;
  delete process.env.GIT_CONFIG_NOSYSTEM;
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.rmSync(home, { recursive: true, force: true });
});

describe('getEffectiveIdentity', () => {
  it('reports a repository-level override as local, naming its config file', async () => {
    run('git config --local user.name Jane');
    run('git config --local user.email jane@repo.com');
    await git.openRepo(tmpDir);

    const identity = await git.getEffectiveIdentity();
    expect(identity.name).toBe('Jane');
    expect(identity.scope).toBe('local');
    expect(identity.origin).toBe(path.join(fs.realpathSync(tmpDir), '.git', 'config'));
  });

  // The whole point of reading the effective value: without a local override
  // git still knows the author, and the app must say so instead of blank.
  it('falls back to the global config and says so', async () => {
    fs.writeFileSync(path.join(home, '.gitconfig'), '[user]\n\tname = Global\n\temail = g@x.com\n');
    await git.openRepo(tmpDir);

    const identity = await git.getEffectiveIdentity();
    expect(identity.email).toBe('g@x.com');
    expect(identity.scope).toBe('global');
  });

  // Support for includeIf falls out of asking git for the origin — there is no
  // code in this app that knows what includeIf is.
  it('resolves an identity pulled in by includeIf and points at that file', async () => {
    const included = path.join(home, 'work.gitconfig');
    fs.writeFileSync(included, '[user]\n\tname = Worker\n\temail = worker@company.com\n');
    // macOS hands out /var/... but git matches on the resolved /private/var/...
    const realRepo = fs.realpathSync(tmpDir);
    fs.writeFileSync(
      path.join(home, '.gitconfig'),
      `[user]\n\tname = Global\n\temail = g@x.com\n[includeIf "gitdir:${realRepo}/"]\n\tpath = ${included}\n`,
    );
    await git.openRepo(tmpDir);

    const identity = await git.getEffectiveIdentity();
    expect(identity.email).toBe('worker@company.com');
    expect(identity.scope).toBe('included');
    expect(identity.origin).toBe(included);
  });

  it('reports no identity at all when nothing sets one', async () => {
    await git.openRepo(tmpDir);
    const identity = await git.getEffectiveIdentity();
    expect(identity.scope).toBe('none');
    expect(identity.name).toBeNull();
    expect(identity.email).toBeNull();
  });
});

describe('setLocalIdentity / clearLocalIdentity', () => {
  it('writes an override and reads it back as local', async () => {
    await git.openRepo(tmpDir);
    const identity = await git.setLocalIdentity('Jane', 'jane@repo.com');
    expect(identity.scope).toBe('local');
    expect(identity.name).toBe('Jane');
  });

  it('removes every key the app may have written, including the old profile marker', async () => {
    run('git config --local user.name Jane');
    run('git config --local user.email jane@repo.com');
    run('git config --local user.signingkey /k.pub');
    run('git config --local gpg.format ssh');
    run('git config --local commit.gpgsign true');
    run('git config --local core.sshCommand "ssh -i /k"');
    // Left behind by an older build of this app.
    run('git config --local gitdesktop.profile abc123');

    await git.openRepo(tmpDir);
    await git.clearLocalIdentity();

    const remaining = execSync('git config --local --list', { cwd: tmpDir }).toString();
    for (const key of [
      'user.name',
      'user.email',
      'user.signingkey',
      'gpg.format',
      'commit.gpgsign',
      'core.sshcommand',
      'gitdesktop.profile',
    ]) {
      expect(remaining, `${key} should be gone`).not.toContain(key);
    }
  });
});

describe('setGlobalIdentity', () => {
  // The point of the global variant: one write covers repositories the app has
  // never opened, so the user does not re-enter the same name everywhere.
  it('writes to the global config, not the repository', async () => {
    await git.openRepo(tmpDir);
    const identity = await git.setGlobalIdentity('Jane', 'jane@global.com');

    expect(identity.scope).toBe('global');
    expect(identity.email).toBe('jane@global.com');
    expect(execSync('git config --local --list', { cwd: tmpDir }).toString()).not.toContain(
      'user.email',
    );
  });

  it('applies to a second repository with no config of its own', async () => {
    await git.openRepo(tmpDir);
    await git.setGlobalIdentity('Jane', 'jane@global.com');

    const other = fs.mkdtempSync(path.join(os.tmpdir(), 'git-desktop-other-'));
    try {
      execSync('git init', { cwd: other });
      const second = new GitService();
      await second.openRepo(other);
      expect((await second.getEffectiveIdentity()).email).toBe('jane@global.com');
    } finally {
      fs.rmSync(other, { recursive: true, force: true });
    }
  });

  it('is still overridden by a repository-level value', async () => {
    await git.openRepo(tmpDir);
    await git.setGlobalIdentity('Jane', 'jane@global.com');
    await git.setLocalIdentity('Jane', 'jane@repo.com');

    const identity = await git.getEffectiveIdentity();
    expect(identity.email).toBe('jane@repo.com');
    expect(identity.scope).toBe('local');
  });
});

describe('inherited identity', () => {
  it('is absent when the repository has no override of its own', async () => {
    fs.writeFileSync(path.join(home, '.gitconfig'), '[user]\n\tname = G\n\temail = g@x.com\n');
    await git.openRepo(tmpDir);
    expect((await git.getEffectiveIdentity()).inherited).toBeNull();
  });

  // What the second row in the settings UI shows: the identity this repository
  // would fall back to. Reading the global config directly would answer wrongly
  // whenever includeIf is involved, so it comes from the precedence list.
  it('reports the global identity that an override is hiding', async () => {
    fs.writeFileSync(path.join(home, '.gitconfig'), '[user]\n\tname = G\n\temail = g@x.com\n');
    await git.openRepo(tmpDir);
    await git.setLocalIdentity('Local', 'local@repo.com');

    const { inherited } = await git.getEffectiveIdentity();
    expect(inherited).toEqual({
      name: 'G',
      email: 'g@x.com',
      origin: path.join(home, '.gitconfig'),
      scope: 'global',
    });
  });

  it('reports an includeIf value, not the plain global one', async () => {
    const included = path.join(home, 'work.gitconfig');
    fs.writeFileSync(included, '[user]\n\tname = Worker\n\temail = worker@company.com\n');
    fs.writeFileSync(
      path.join(home, '.gitconfig'),
      `[user]\n\tname = G\n\temail = g@x.com\n[includeIf "gitdir:${fs.realpathSync(tmpDir)}/"]\n\tpath = ${included}\n`,
    );
    await git.openRepo(tmpDir);
    await git.setLocalIdentity('Local', 'local@repo.com');

    const { inherited } = await git.getEffectiveIdentity();
    expect(inherited?.email).toBe('worker@company.com');
    expect(inherited?.scope).toBe('included');
  });

  it('matches what actually applies once the override is cleared', async () => {
    fs.writeFileSync(path.join(home, '.gitconfig'), '[user]\n\tname = G\n\temail = g@x.com\n');
    await git.openRepo(tmpDir);
    await git.setLocalIdentity('Local', 'local@repo.com');
    const predicted = (await git.getEffectiveIdentity()).inherited;

    const after = await git.clearLocalIdentity();
    expect(after.email).toBe(predicted?.email);
    expect(after.scope).toBe(predicted?.scope);
  });
});
