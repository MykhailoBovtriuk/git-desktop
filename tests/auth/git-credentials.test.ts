import { describe, it, expect, beforeEach, vi } from 'vitest';

interface Call {
  args: string[];
  stdin: string | null;
  env: NodeJS.ProcessEnv;
  cwd: string | undefined;
}

const calls: Call[] = [];
let configValue = '';
let fillOutput = '';
let regexpOutput = '';
let failNext = false;

vi.mock('child_process', () => ({
  execFile: (
    _cmd: string,
    args: string[],
    options: { env: NodeJS.ProcessEnv; cwd?: string },
    cb: (err: Error | null, stdout: string) => void,
  ) => {
    const call: Call = { args, stdin: null, env: options.env, cwd: options.cwd };
    calls.push(call);
    // Deferred so the caller has a chance to write to stdin first, exactly as
    // the real execFile behaves.
    queueMicrotask(() => {
      if (failNext) {
        failNext = false;
        cb(new Error('exit 1'), '');
        return;
      }
      if (args.includes('fill')) cb(null, fillOutput);
      else if (args.includes('--get-regexp')) cb(null, regexpOutput);
      else cb(null, args.includes('--get') || args.includes('--get-urlmatch') ? configValue : '');
    });
    return { stdin: { end: (data: string) => (call.stdin = data) } };
  },
}));

const credentials = await import('../../electron/auth/git-credentials');

const find = (needle: string) => calls.find(c => c.args.join(' ').includes(needle));

describe('allowedHelpers', () => {
  it('offers the platform helper and nothing on an unknown platform', () => {
    expect(credentials.allowedHelpers('darwin')).toEqual(['osxkeychain']);
    expect(credentials.allowedHelpers('win32')).toEqual(['manager', 'manager-core']);
    expect(credentials.allowedHelpers('linux')).toEqual(['libsecret', 'cache --timeout=3600']);
    expect(credentials.allowedHelpers('sunos')).toEqual([]);
  });

  it('keeps a helper with arguments as one value', () => {
    expect(credentials.allowedHelpers('linux')[1]).toBe('cache --timeout=3600');
  });
});

describe('ensureCredentialHelper', () => {
  beforeEach(() => {
    calls.length = 0;
    configValue = '';
    failNext = false;
  });

  it('leaves a helper the user already configured alone', async () => {
    configValue = 'my-own-helper\n';
    expect(await credentials.ensureCredentialHelper()).toBe('my-own-helper');
    expect(find('config --global credential.helper my-own-helper')).toBeUndefined();
  });

  it('configures one when git has none', async () => {
    const helper = await credentials.ensureCredentialHelper();
    expect(helper).toBe(credentials.allowedHelpers()[0] ?? null);
    if (helper) {
      expect(find(`config --global credential.helper ${helper}`)).toBeDefined();
    }
  });
});

describe('approveCredentials', () => {
  beforeEach(() => {
    calls.length = 0;
    configValue = 'osxkeychain';
    failNext = false;
  });

  it('passes the token over stdin, never on the command line', async () => {
    await credentials.approveCredentials('github.com', 'octocat', 's3cret-token');

    const approve = find('credential approve')!;
    expect(approve).toBeDefined();
    expect(approve.args.join(' ')).not.toContain('s3cret-token');
    expect(approve.stdin).toBe(
      'protocol=https\nhost=github.com\nusername=octocat\npassword=s3cret-token\n\n',
    );
  });

  it('erases a stored credential without naming a password', async () => {
    await credentials.rejectCredentials('github.com', 'octocat');
    const reject = find('credential reject')!;
    expect(reject.stdin).toBe('protocol=https\nhost=github.com\nusername=octocat\n\n');
  });

  it('survives a failing reject', async () => {
    failNext = true;
    await expect(credentials.rejectCredentials('github.com', 'octocat')).resolves.toBeUndefined();
  });
});

describe('gitUsernameFor', () => {
  const base = {
    id: '/src/p',
    repoPath: '/src/p',
    host: 'x',
    displayName: 'X',
    login: 'octocat',
    name: null,
    email: '',
    avatarDataUrl: null,
  };

  it('sends the login for providers that read it', () => {
    expect(credentials.gitUsernameFor({ ...base, providerId: 'github' })).toBe('octocat');
  });

  it('sends a fixed username for Azure DevOps', () => {
    expect(credentials.gitUsernameFor({ ...base, providerId: 'azure-devops' })).toBe('oauth2');
  });
});

describe('storedCredential for a host', () => {
  beforeEach(() => {
    calls.length = 0;
    fillOutput = '';
    failNext = false;
  });

  it('names the user when a helper answers with a password', async () => {
    fillOutput = 'protocol=https\nhost=github.com\nusername=alice\npassword=ghp_x\n';
    await expect(credentials.storedCredential({ host: 'github.com' })).resolves.toEqual({
      username: 'alice',
      password: 'ghp_x',
    });
    expect(find('credential fill')?.stdin).toBe('protocol=https\nhost=github.com\n\n');
  });

  it('is null when the answer carries no password', async () => {
    fillOutput = 'protocol=https\nhost=github.com\nusername=alice\npassword=\n';
    await expect(credentials.storedCredential({ host: 'github.com' })).resolves.toBeNull();
  });

  it('is null when git fails rather than asking a terminal', async () => {
    failNext = true;
    await expect(credentials.storedCredential({ host: 'github.com' })).resolves.toBeNull();
  });

  it('never lets an askpass answer the question for it', async () => {
    fillOutput = 'password=x\n';
    await credentials.storedCredential({ host: 'github.com' });
    const env = find('credential fill')?.env ?? {};
    expect(env.GIT_TERMINAL_PROMPT).toBe('0');
    expect(env.GIT_ASKPASS).toBeUndefined();
  });
});

describe('storedCredential', () => {
  beforeEach(() => {
    calls.length = 0;
    fillOutput = '';
    failNext = false;
  });

  it('asks from inside the repository, with the path of its remote', async () => {
    fillOutput = 'protocol=https\nhost=dev.azure.com\nusername=oauth2\npassword=tok\n';
    await expect(
      credentials.storedCredential({
        host: 'dev.azure.com',
        path: 'org/proj/_git/repo',
        cwd: '/src/p',
      }),
    ).resolves.toEqual({ username: 'oauth2', password: 'tok' });
    const fill = find('credential fill');
    expect(fill?.cwd).toBe('/src/p');
    expect(fill?.stdin).toBe('protocol=https\nhost=dev.azure.com\npath=org/proj/_git/repo\n\n');
    expect(fill?.env.GCM_INTERACTIVE).toBe('never');
    expect(fill?.env.GIT_TERMINAL_PROMPT).toBe('0');
    expect(fill?.env.GIT_ASKPASS).toBeUndefined();
  });

  it('passes the username the remote URL names', async () => {
    await credentials.storedCredential({
      host: 'github.com',
      path: 'a/b.git',
      username: 'jane',
      cwd: '/src/p',
    });
    expect(find('credential fill')?.stdin).toBe(
      'protocol=https\nhost=github.com\npath=a/b.git\nusername=jane\n\n',
    );
  });

  it('is null when nothing is stored', async () => {
    await expect(
      credentials.storedCredential({ host: 'github.com', cwd: '/src/p' }),
    ).resolves.toBeNull();
  });
});

describe('credentialHelpersFor', () => {
  beforeEach(() => {
    calls.length = 0;
    regexpOutput = '';
  });

  it('reads the helpers from inside the repository', async () => {
    regexpOutput = 'local\tcredential.helper manager';
    const helpers = await credentials.credentialHelpersFor('github.com', '/src/p');
    expect(helpers.map(h => h.cli)).toEqual(['gcm']);
    expect(find('--get-regexp')?.cwd).toBe('/src/p');
  });

  it('keeps only the helpers that apply to the host', async () => {
    regexpOutput = [
      'global\tcredential.helper osxkeychain',
      'global\tcredential.https://dev.azure.com.helper /usr/local/bin/git-credential-manager',
    ].join('\n');
    const github = await credentials.credentialHelpersFor('github.com', '/src/p');
    expect(github.map(h => h.helper)).toEqual(['osxkeychain']);
    const azure = await credentials.credentialHelpersFor('dev.azure.com', '/src/p');
    expect(azure.map(h => h.cli)).toEqual([null, 'gcm']);
  });
});

describe('forgetStoredCredential', () => {
  beforeEach(() => {
    calls.length = 0;
    fillOutput = '';
    failNext = false;
  });

  it('erases the credential git would have used', async () => {
    fillOutput = 'protocol=https\nhost=github.com\nusername=alice\npassword=ghp_x\n';
    await expect(credentials.forgetStoredCredential('github.com')).resolves.toBe(true);
    expect(find('credential reject')?.stdin).toBe(
      'protocol=https\nhost=github.com\nusername=alice\npassword=ghp_x\n\n',
    );
  });

  it('erases nothing when nothing is stored', async () => {
    fillOutput = 'protocol=https\nhost=github.com\n';
    await expect(credentials.forgetStoredCredential('github.com')).resolves.toBe(false);
    expect(find('credential reject')).toBeUndefined();
  });

  it('never lets an askpass invent the credential it then erases', async () => {
    await credentials.forgetStoredCredential('github.com');
    const env = find('credential fill')?.env ?? {};
    expect(env.GIT_TERMINAL_PROMPT).toBe('0');
    expect(env.GIT_ASKPASS).toBeUndefined();
  });
});

describe('listCredentialHelpers', () => {
  beforeEach(() => {
    calls.length = 0;
    regexpOutput = '';
  });

  it('reads every helper with its scope and URL', async () => {
    regexpOutput = [
      'unknown\tcredential.helper osxkeychain',
      'global\tcredential.https://github.com.helper ',
      'global\tcredential.https://github.com.helper !/opt/homebrew/bin/gh auth git-credential',
      'global\tcredential.https://gitlab.com.helper !glab auth git-credential',
      'system\tcredential.helper manager',
    ].join('\n');

    expect(await credentials.listCredentialHelpers()).toEqual([
      { url: null, helper: 'osxkeychain', scope: 'system', cli: null },
      {
        url: 'https://github.com',
        helper: '!/opt/homebrew/bin/gh auth git-credential',
        scope: 'global',
        cli: 'gh',
      },
      {
        url: 'https://gitlab.com',
        helper: '!glab auth git-credential',
        scope: 'global',
        cli: 'glab',
      },
      { url: null, helper: 'manager', scope: 'system', cli: 'gcm' },
    ]);
  });

  it('drops helpers an empty value resets', async () => {
    regexpOutput = [
      'global\tcredential.https://github.com.helper store',
      'global\tcredential.https://github.com.helper ',
      'global\tcredential.https://github.com.helper !gh auth git-credential',
    ].join('\n');
    const list = await credentials.listCredentialHelpers();
    expect(list.map(e => e.helper)).toEqual(['!gh auth git-credential']);
  });

  it('answers with nothing when git has none, or fails', async () => {
    expect(await credentials.listCredentialHelpers()).toEqual([]);
    failNext = true;
    expect(await credentials.listCredentialHelpers()).toEqual([]);
  });
});

describe('the silent credential lookup', () => {
  beforeEach(() => {
    calls.length = 0;
    fillOutput = '';
  });

  it('keeps Git Credential Manager from asking', async () => {
    await credentials.storedCredential({ host: 'github.com' });
    expect(find('credential fill')?.env.GCM_INTERACTIVE).toBe('never');
  });
});

describe('ensureCredentialHelper for a host', () => {
  beforeEach(() => {
    calls.length = 0;
    configValue = '';
  });

  it('asks git for the helper that applies to that host', async () => {
    configValue = '!gh auth git-credential\n';
    expect(await credentials.ensureCredentialHelper('github.com')).toBe('!gh auth git-credential');
    expect(find('--get-urlmatch credential.helper https://github.com')).toBeDefined();
    expect(find('config --global credential.helper')).toBeUndefined();
  });
});

describe('binding a repository to a login', () => {
  beforeEach(() => {
    calls.length = 0;
    failNext = false;
  });

  it("writes the username into the repository's own config", async () => {
    await credentials.bindRepoUsername('/src/p', 'github.com', 'octocat');
    expect(
      find('-C /src/p config --local credential.https://github.com.username octocat'),
    ).toBeDefined();
  });

  it('removes it again, quietly when the folder is gone', async () => {
    failNext = true;
    await expect(credentials.unbindRepoUsername('/gone', 'github.com')).resolves.toBeUndefined();
    expect(
      find('-C /gone config --local --unset-all credential.https://github.com.username'),
    ).toBeDefined();
  });
});
