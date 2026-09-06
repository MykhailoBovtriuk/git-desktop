import { describe, it, expect, beforeEach, vi } from 'vitest';

type Handler = (...args: unknown[]) => void;

const listeners = new Map<string, Handler[]>();
const state = { hasLock: true, ready: [] as (() => void)[], argv: [] as string[] };
const setAsDefault = vi.fn();

vi.mock('electron', () => ({
  app: {
    requestSingleInstanceLock: () => state.hasLock,
    setAsDefaultProtocolClient: (...args: unknown[]) => setAsDefault(...args),
    on: (event: string, handler: Handler) => {
      listeners.set(event, [...(listeners.get(event) ?? []), handler]);
    },
    // Resolved by hand so a test can control whether the URL arrives before or
    // after the app is ready — which is the whole point of the buffer.
    whenReady: () =>
      new Promise<void>(resolve => {
        state.ready.push(resolve);
      }),
  },
}));

const deepLink = await import('../../electron/auth/deep-link');

const emit = (event: string, ...args: unknown[]) =>
  (listeners.get(event) ?? []).forEach(h => h(...args));

const becomeReady = async () => {
  state.ready.forEach(resolve => resolve());
  state.ready = [];
  await Promise.resolve();
  await Promise.resolve();
};

describe('findDeepLink', () => {
  it('picks the callback out of an argument list', () => {
    expect(
      deepLink.findDeepLink(['electron.exe', '--flag', 'git-desktop-auth://oauth?code=1']),
    ).toBe('git-desktop-auth://oauth?code=1');
  });

  it('ignores arguments belonging to somebody else', () => {
    expect(deepLink.findDeepLink(['electron.exe', 'https://example.com', '/some/path'])).toBeNull();
  });
});

describe('initDeepLinks', () => {
  beforeEach(() => {
    listeners.clear();
    state.hasLock = true;
    state.ready = [];
    vi.spyOn(process, 'argv', 'get').mockReturnValue(['electron', '.']);
  });

  // Without the lock, a Windows redirect launches a second copy of the app and
  // the first one waits forever for a callback that went elsewhere.
  it('reports the lock being held by another instance', () => {
    state.hasLock = false;
    expect(deepLink.initDeepLinks(vi.fn())).toBe(false);
  });

  it('delivers a macOS open-url once the app is ready', async () => {
    const onUrl = vi.fn();
    deepLink.initDeepLinks(onUrl);
    await becomeReady();

    emit('open-url', { preventDefault: vi.fn() }, 'git-desktop-auth://oauth?code=abc');
    expect(onUrl).toHaveBeenCalledWith('git-desktop-auth://oauth?code=abc');
  });

  // A cold start triggered by the redirect itself fires open-url before the
  // app is ready; dropping it there would lose the sign-in entirely.
  it('buffers a URL that arrives before the app is ready', async () => {
    const onUrl = vi.fn();
    deepLink.initDeepLinks(onUrl);

    emit('open-url', { preventDefault: vi.fn() }, 'git-desktop-auth://oauth?code=early');
    expect(onUrl).not.toHaveBeenCalled();

    await becomeReady();
    expect(onUrl).toHaveBeenCalledWith('git-desktop-auth://oauth?code=early');
  });

  it('ignores an open-url for a scheme that is not ours', async () => {
    const onUrl = vi.fn();
    deepLink.initDeepLinks(onUrl);
    await becomeReady();

    emit('open-url', { preventDefault: vi.fn() }, 'https://example.com/oauth');
    expect(onUrl).not.toHaveBeenCalled();
  });

  // Windows and Linux relaunch the binary with the URL in argv; the running
  // instance receives it through second-instance.
  it('delivers a URL that arrives in a second instance argv', async () => {
    const onUrl = vi.fn();
    deepLink.initDeepLinks(onUrl);
    await becomeReady();

    emit('second-instance', {}, ['app.exe', 'git-desktop-auth://oauth?code=win']);
    expect(onUrl).toHaveBeenCalledWith('git-desktop-auth://oauth?code=win');
  });

  it('ignores a second instance launched without a callback', async () => {
    const onUrl = vi.fn();
    deepLink.initDeepLinks(onUrl);
    await becomeReady();

    emit('second-instance', {}, ['app.exe', '--some-flag']);
    expect(onUrl).not.toHaveBeenCalled();
  });
});
