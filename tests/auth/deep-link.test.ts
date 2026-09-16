import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

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

describe('bundleDeclaresScheme', () => {
  const bundleWith = (plist: string | null): string => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-bundle-'));
    const macos = path.join(dir, 'App.app', 'Contents', 'MacOS');
    fs.mkdirSync(macos, { recursive: true });
    if (plist !== null) {
      fs.writeFileSync(path.join(dir, 'App.app', 'Contents', 'Info.plist'), plist);
    }
    return path.join(macos, 'Electron');
  };

  it('sees the scheme in an XML plist', () => {
    const exe = bundleWith(
      '<plist><dict><key>CFBundleURLSchemes</key><array><string>git-desktop-auth</string></array></dict></plist>',
    );
    expect(deepLink.bundleDeclaresScheme(exe)).toBe(true);
  });

  // Binary plists store the scheme as plain text too, which is why this reads
  // rather than parses.
  it('sees the scheme in a binary plist', () => {
    const exe = bundleWith(null);
    const plist = path.resolve(path.dirname(exe), '..', 'Info.plist');
    fs.writeFileSync(
      plist,
      Buffer.concat([
        Buffer.from('bplist00', 'latin1'),
        Buffer.from([0x5f, 0x10, 0x10]),
        Buffer.from('git-desktop-auth', 'latin1'),
      ]),
    );
    expect(deepLink.bundleDeclaresScheme(exe)).toBe(true);
  });

  it('says no for a bundle that claims nothing', () => {
    expect(
      deepLink.bundleDeclaresScheme(
        bundleWith(
          '<plist><dict><key>CFBundleIdentifier</key><string>com.github.Electron</string></dict></plist>',
        ),
      ),
    ).toBe(false);
  });

  it('says no when there is no bundle at all', () => {
    expect(deepLink.bundleDeclaresScheme('/usr/local/bin/node')).toBe(false);
  });
});

describe('registerProtocol', () => {
  const asPlatform = (platform: string, execPath: string, fn: () => void) => {
    const platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform')!;
    const execDescriptor = Object.getOwnPropertyDescriptor(process, 'execPath')!;
    Object.defineProperty(process, 'platform', { value: platform, configurable: true });
    Object.defineProperty(process, 'execPath', { value: execPath, configurable: true });
    try {
      fn();
    } finally {
      Object.defineProperty(process, 'platform', platformDescriptor);
      Object.defineProperty(process, 'execPath', execDescriptor);
    }
  };

  const bundle = (declares: boolean): string => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-bundle-'));
    const macos = path.join(dir, 'App.app', 'Contents', 'MacOS');
    fs.mkdirSync(macos, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'App.app', 'Contents', 'Info.plist'),
      declares ? '<plist><string>git-desktop-auth</string></plist>' : '<plist></plist>',
    );
    return path.join(macos, 'Electron');
  };

  beforeEach(() => setAsDefault.mockClear());

  // A plain `electron .` runs inside Electron's own bundle, and claiming a
  // scheme there points the OS at `com.github.Electron` — an identifier several
  // shipped apps carry a copy of. The callback lands in one of those, and the
  // preference is system-wide and sticky, so it takes the installed app's
  // callback with it.
  it('claims nothing on macOS from a bundle that does not declare the scheme', () => {
    asPlatform('darwin', bundle(false), () => deepLink.registerProtocol());
    expect(setAsDefault).not.toHaveBeenCalled();
  });

  // Both the packaged app and the development bundle declare it, and both are
  // entitled to it.
  it('claims the scheme on macOS from a bundle that does declare it', () => {
    asPlatform('darwin', bundle(true), () => deepLink.registerProtocol());
    expect(setAsDefault).toHaveBeenCalledWith('git-desktop-auth');
  });

  // Windows and Linux route by executable path, so a dev run can point the
  // scheme at the project rather than at a bare electron with nothing to run.
  it('points the scheme at the project on Windows in development', () => {
    const previousDefaultApp = process.defaultApp;
    (process as { defaultApp?: boolean }).defaultApp = true;
    try {
      asPlatform('win32', process.execPath, () => deepLink.registerProtocol());
    } finally {
      (process as { defaultApp?: boolean }).defaultApp = previousDefaultApp;
    }
    expect(setAsDefault).toHaveBeenCalledWith(
      'git-desktop-auth',
      expect.any(String),
      expect.arrayContaining([expect.any(String)]),
    );
  });
});

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
