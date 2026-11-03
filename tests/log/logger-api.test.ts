import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { describeError, errorWithCause } from '../../src/lib/error-message';
import {
  logEvent,
  logged,
  logIdOf,
  markCurrent,
  recordCommand,
  setLogSink,
} from '../../electron/log/git-logger';
import { wrap } from '../../electron/ipc/wrap';
import type { LogEntry } from '../../src/types';

let seen: LogEntry[];

beforeEach(() => {
  seen = [];
  setLogSink(e => seen.push(e));
});

afterEach(() => setLogSink(() => {}));

describe('quiet operations', () => {
  it('leave no entry when they succeed', async () => {
    await logged('refresh', '/r', 'status', async () => 1, { quiet: true });
    expect(seen).toEqual([]);
  });

  it('leave one settled entry, never a running one, when they fail', async () => {
    await expect(
      logged('refresh', '/r', 'status', () => Promise.reject(new Error('fatal: bad')), {
        quiet: true,
      }),
    ).rejects.toThrow();
    expect(seen.map(e => e.status)).toEqual(['error']);
  });

  it('fold a repeated failure into one entry with a count', async () => {
    const fail = () =>
      logged('refresh', '/r', 'status', () => Promise.reject(new Error('fatal: bad')), {
        quiet: true,
      }).catch(() => {});
    await fail();
    await fail();
    await fail();
    expect(new Set(seen.map(e => e.id)).size).toBe(1);
    expect(seen[seen.length - 1].count).toBe(3);
  });

  it('are logged when marked as a warning', async () => {
    await logged(
      'probe-server',
      null,
      'gitlab · git.acme',
      async () => markCurrent({ status: 'warning', error: 'Could not reach git.acme' }),
      { quiet: true },
    );
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ status: 'warning', error: 'Could not reach git.acme' });
  });
});

describe('logged', () => {
  it('records an expected failure as info', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    await expect(
      logged('update-download', null, '1.2.0', () => Promise.reject(abort), {
        expected: err => (err as Error).name === 'AbortError',
      }),
    ).rejects.toBe(abort);
    expect(seen[seen.length - 1].status).toBe('info');
  });

  it('keeps the cause of an error that rewrites it', async () => {
    const err = errorWithCause('GitHub rejected this token', new Error('returned 401'));
    await logged('sign-in-token', '/r', undefined, () => Promise.reject(err)).catch(() => {});
    expect(seen[seen.length - 1].error).toBe(
      'GitHub rejected this token — caused by: returned 401',
    );
  });

  it('classifies a failure', async () => {
    await logged('push', '/r', undefined, () =>
      Promise.reject(new Error('fatal: Authentication failed for https://x')),
    ).catch(() => {});
    expect(seen[seen.length - 1].errorKind).toBe('auth');
  });

  it('classifies only git failures, whose wording the classifier knows', async () => {
    await logged('update-download', null, '1.2.0', () =>
      Promise.reject(new Error('Merge conflict in the release notes')),
    ).catch(() => {});
    expect(seen[seen.length - 1].errorKind).toBeUndefined();
  });

  it('collects commands recorded by hand, and ignores them outside an entry', async () => {
    recordCommand(['git', 'config', 'x'], '', '');
    await logged('identity-set', '/r', 'global', async () => {
      recordCommand(['git', 'config', '--global', 'user.name', 'A'], '', '');
    });
    expect(seen[seen.length - 1].commands.map(c => c.argv.join(' '))).toEqual([
      'git config --global user.name A',
    ]);
  });

  it('redacts what it records', async () => {
    await logged('token-refresh', '/r', 'github.com', async () => {
      recordCommand(['POST', 'https://h/token?refresh_token=abc123'], 'HTTP 200', '');
    });
    expect(seen[seen.length - 1].commands[0].argv[1]).toBe('https://h/token?refresh_token=***');
  });
});

describe('logEvent', () => {
  it('sends a settled entry and returns its id', () => {
    const id = logEvent({
      op: 'accounts-load',
      repoPath: null,
      status: 'warning',
      error: new Error('accounts.json is not JSON'),
    });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ id, op: 'accounts-load', status: 'warning', repoPath: null });
  });
});

describe('the log id of a failure', () => {
  it('travels from the entry to the IPC envelope', async () => {
    const result = await wrap(() =>
      logged('push', '/r', undefined, () => Promise.reject(new Error('rejected'))),
    );
    const entry = seen[seen.length - 1];
    expect(result).toEqual({ error: 'rejected', logId: entry.id });
  });

  it('is the folded entry for a repeated quiet failure', async () => {
    const fail = () =>
      wrap(() =>
        logged('refresh', '/r', 'log', () => Promise.reject(new Error('x')), { quiet: true }),
      );
    const first = await fail();
    const second = await fail();
    expect('logId' in second && second.logId).toBe('logId' in first && first.logId);
  });

  it('is absent for failures nothing logged', async () => {
    const err = new Error('plain');
    expect(logIdOf(err)).toBeUndefined();
    expect(await wrap(() => Promise.reject(err))).toEqual({ error: 'plain' });
  });
});

describe('describeError', () => {
  it('stops at the first message and skips repeats', () => {
    const inner = new Error('ENOTFOUND');
    const outer = errorWithCause('fetch failed', errorWithCause('ENOTFOUND', inner));
    expect(describeError(outer)).toBe('fetch failed — caused by: ENOTFOUND');
    expect(describeError('raw')).toBe('raw');
  });
});
