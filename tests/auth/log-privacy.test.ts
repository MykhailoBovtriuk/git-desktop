import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import type { LogEntry, ProviderAccount } from '../../src/types';

const TOKEN = 'Zq7opaqueTok3nWithNoKnownShape';
const SECRET = 'cl1entSecretValueNoShape';
const EMAIL = 'jane.doe@corp.example.com';

vi.mock('child_process', async importOriginal => {
  const actual = await importOriginal<typeof import('child_process')>();
  const { promisify } = await import('util');
  const execFile = (
    _cmd: string,
    args: string[],
    _options: unknown,
    cb: (err: Error | null, stdout: string, stderr: string) => void,
  ) => {
    queueMicrotask(() => {
      if (args.includes('fill')) cb(null, `protocol=https\nusername=jane\npassword=${TOKEN}\n`, '');
      else if (args.includes('--get-urlmatch')) cb(null, 'osxkeychain\n', '');
      else cb(null, '', '');
    });
    return { stdin: { end: () => {} } };
  };
  // electron/git/exec promisifies execFile: that path keeps running the real git.
  Object.assign(execFile, {
    [promisify.custom]: (actual.execFile as unknown as Record<symbol, unknown>)[promisify.custom],
  });
  return { ...actual, execFile };
});

const { logged, setLogSink } = await import('../../electron/log/git-logger');
const credentials = await import('../../electron/auth/git-credentials');
const { getJson, postToken } = await import('../../electron/auth/http');
const { ensureGlobalIdentity } = await import('../../electron/auth/identity-bootstrap');

let seen: LogEntry[];
let home: string;
let saved: { home?: string; nosystem?: string };

beforeEach(() => {
  seen = [];
  setLogSink(e => seen.push(e));
  home = fs.mkdtempSync(path.join(os.tmpdir(), 'git-desktop-privacy-'));
  saved = { home: process.env.HOME, nosystem: process.env.GIT_CONFIG_NOSYSTEM };
  // git reads --global from $HOME: a scratch home keeps the runner's identity untouched.
  process.env.HOME = home;
  process.env.GIT_CONFIG_NOSYSTEM = '1';
});

afterEach(() => {
  setLogSink(() => {});
  vi.unstubAllGlobals();
  process.env.HOME = saved.home;
  if (saved.nosystem === undefined) delete process.env.GIT_CONFIG_NOSYSTEM;
  else process.env.GIT_CONFIG_NOSYSTEM = saved.nosystem;
  fs.rmSync(home, { recursive: true, force: true });
});

const logText = () => {
  expect(seen.length).toBeGreaterThan(0);
  return JSON.stringify(seen);
};

describe('auth logging keeps private data out', () => {
  it('never records a token handed to or read from the credential store', async () => {
    await logged('sign-in-token', null, 'github · github.com', async () => {
      await credentials.approveCredentials('github.com', 'jane', TOKEN);
      await credentials.forgetStoredCredential('github.com');
    });
    const text = logText();
    expect(text).toContain('credential');
    expect(text).not.toContain(TOKEN);
  });

  it('never records a token, client secret or server error body from HTTP calls', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(`{"echo":"${TOKEN} ${SECRET}"}`, { status: 401 })),
    );
    await logged('sign-in-callback', null, undefined, async () => {
      await getJson('https://api.github.com/user', TOKEN).catch(() => {});
      await postToken('https://github.com/login/oauth/access_token', {
        client_id: 'id',
        client_secret: SECRET,
        refresh_token: TOKEN,
      });
    }).catch(() => {});
    const text = logText();
    expect(text).toContain('HTTP 401');
    expect(text).not.toContain(TOKEN);
    expect(text).not.toContain(SECRET);
  });

  it('never records the account email, even when it is written to git config', async () => {
    const account: ProviderAccount = {
      id: '/src/p',
      repoPath: '/src/p',
      providerId: 'github',
      host: 'github.com',
      displayName: 'GitHub',
      login: 'jane',
      name: 'Jane Doe',
      email: EMAIL,
      avatarDataUrl: null,
    };
    await logged('sign-in-token', null, undefined, () => ensureGlobalIdentity(account));
    const text = logText();
    expect(text).toContain('identity-auto');
    expect(text).toContain('user.email');
    expect(text).not.toContain(EMAIL);
  });
});
