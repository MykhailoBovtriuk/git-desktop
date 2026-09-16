import { describe, it, expect, beforeEach, vi } from 'vitest';

interface Call {
  args: string[];
  stdin: string | null;
  env: NodeJS.ProcessEnv;
}

const calls: Call[] = [];
/** Per-invocation behaviour, keyed by the git subcommand under test. */
let configValue = '';
let fillOutput = '';
let failNext = false;

vi.mock('child_process', () => ({
  execFile: (
    _cmd: string,
    args: string[],
    options: { env: NodeJS.ProcessEnv },
    cb: (err: Error | null, stdout: string) => void,
  ) => {
    const call: Call = { args, stdin: null, env: options.env };
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
      else cb(null, args.includes('--get') ? configValue : '');
    });
    return { stdin: { end: (data: string) => (call.stdin = data) } };
  },
}));

const credentials = await import('../../electron/auth/git-credentials');

const find = (needle: string) => calls.find(c => c.args.join(' ').includes(needle));

describe('allowedHelpers', () => {
  // A credential helper is a command git executes, so the app writes only
  // values it named itself — never something that reached it from outside.
  it('offers the platform helper and nothing on an unknown platform', () => {
    expect(credentials.allowedHelpers('darwin')).toEqual(['osxkeychain']);
    expect(credentials.allowedHelpers('win32')).toEqual(['manager', 'manager-core']);
    expect(credentials.allowedHelpers('linux')).toEqual(['libsecret', 'cache --timeout=3600']);
    expect(credentials.allowedHelpers('sunos')).toEqual([]);
  });

  it('keeps a helper with arguments as one value', () => {
    // Split into two argv entries, "--timeout=3600" would become a flag for
    // `git config` itself rather than part of the helper command.
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

  // Without a helper, `git credential approve` succeeds and stores nothing —
  // a silent no-op that leaves every push failing after a successful sign-in.
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

  // An argument list is readable by every process on the machine via `ps`.
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

  // A helper may have nothing to erase; that is the desired end state anyway.
  it('survives a failing reject', async () => {
    failNext = true;
    await expect(credentials.rejectCredentials('github.com', 'octocat')).resolves.toBeUndefined();
  });
});

describe('gitUsernameFor', () => {
  const base = {
    id: 'x|octocat',
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

  // dev.azure.com ignores the username and reads the token from the password
  // field; a fixed value keeps the stored credential stable across renames.
  it('sends a fixed username for Azure DevOps', () => {
    expect(credentials.gitUsernameFor({ ...base, providerId: 'azure-devops' })).toBe('oauth2');
  });
});

describe('hasStoredCredential', () => {
  beforeEach(() => {
    calls.length = 0;
    fillOutput = '';
    failNext = false;
  });

  it('is true when a helper answers with a password', async () => {
    fillOutput = 'protocol=https\nhost=github.com\nusername=alice\npassword=ghp_x\n';
    await expect(credentials.hasStoredCredential('github.com')).resolves.toBe(true);
    expect(find('credential fill')?.stdin).toBe('protocol=https\nhost=github.com\n\n');
  });

  // An empty password is what an askpass stub hands back; it is not a
  // credential, and treating it as one would silence the sign-in offer for
  // exactly the user who needs it.
  it('is false when the answer carries no password', async () => {
    fillOutput = 'protocol=https\nhost=github.com\nusername=alice\npassword=\n';
    await expect(credentials.hasStoredCredential('github.com')).resolves.toBe(false);
  });

  it('is false when git fails rather than asking a terminal', async () => {
    failNext = true;
    await expect(credentials.hasStoredCredential('github.com')).resolves.toBe(false);
  });

  it('never lets an askpass answer the question for it', async () => {
    fillOutput = 'password=x\n';
    await credentials.hasStoredCredential('github.com');
    const env = find('credential fill')?.env ?? {};
    expect(env.GIT_TERMINAL_PROMPT).toBe('0');
    expect(env.GIT_ASKPASS).toBeUndefined();
  });
});
