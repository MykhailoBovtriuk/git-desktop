import { describe, it, expect } from 'vitest';
import { wrap } from '../electron/ipc-handlers';

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
