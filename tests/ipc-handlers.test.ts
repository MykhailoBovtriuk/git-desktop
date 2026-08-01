import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { wrap, registerIpcHandlers } from '../electron/ipc-handlers';
import { ipcMain } from 'electron';

vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
  dialog: { showOpenDialog: vi.fn() },
}));

describe('wrap', () => {
  it('resolves to a data envelope on success', async () => {
    const result = await wrap(() => Promise.resolve(42));
    expect(result).toEqual({ data: 42 });
  });

  it('converts promise rejections into the error envelope', async () => {
    const result = await wrap(() => Promise.reject(new Error('boom')));
    expect(result).toEqual({ error: 'boom', code: 'GIT_ERROR' });
  });

  // Regression: validators throw synchronously inside the handler callback.
  // With `fn()` called before .then/.catch are attached, the exception escaped
  // the envelope and Electron delivered a mangled rejected promise instead of
  // { error, code }.
  it('converts synchronous throws into the error envelope', async () => {
    const result = await wrap(() => {
      throw new Error('Invalid argument: hash must be a commit hash');
    });
    expect(result).toEqual({
      error: 'Invalid argument: hash must be a commit hash',
      code: 'GIT_ERROR',
    });
  });

  it('stringifies non-Error throws instead of returning undefined error', async () => {
    const result = await wrap(() => Promise.reject('raw string failure'));
    expect(result).toEqual({ error: 'raw string failure', code: 'GIT_ERROR' });
  });
});

describe('registered IPC channels', () => {
  const registered = () => {
    registerIpcHandlers();
    const handle = ipcMain.handle as unknown as ReturnType<typeof vi.fn>;
    return [...new Set(handle.mock.calls.map(c => c[0] as string))].sort();
  };

  const channelsInFile = (relPath: string) => {
    const src = fs.readFileSync(path.resolve(__dirname, '..', relPath), 'utf-8');
    return [...new Set([...src.matchAll(/'(git:[a-z-]+)'/g)].map(m => m[1]))].sort();
  };

  it('registers the rebase lifecycle channels', () => {
    const channels = registered();
    expect(channels).toContain('git:is-rebasing');
    expect(channels).toContain('git:abort-rebase');
    expect(channels).toContain('git:continue-rebase');
  });

  it('main-process handlers, preload allowlist and renderer api stay in sync', () => {
    const channels = registered();
    expect(channels.length).toBeGreaterThan(0);
    expect(channelsInFile('electron/preload.ts')).toEqual(channels);
    expect(channelsInFile('src/api/git-api.ts')).toEqual(channels);
  });
});
