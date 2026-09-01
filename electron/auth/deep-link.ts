import { app } from 'electron';
import path from 'path';
import { PROTOCOL_SCHEME } from './oauth-config';

/**
 * Getting the browser's redirect back into this process.
 *
 * Three platforms, three mechanisms, and they disagree about when the URL
 * arrives — hence one module rather than a scattering of `process.platform`
 * checks in main.ts.
 */

const PREFIX = `${PROTOCOL_SCHEME}://`;

/**
 * Claim the scheme with the OS.
 *
 * Must run before `app.whenReady()` on Windows, where it writes to the registry
 * that the launcher consults. In development the executable is Electron itself,
 * so the app path has to be passed explicitly or the OS would hand the URL to a
 * bare `electron` with no project to run.
 */
export function registerProtocol(): void {
  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL_SCHEME, process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL_SCHEME);
  }
}

export function findDeepLink(argv: string[]): string | null {
  return argv.find(arg => arg.startsWith(PREFIX)) ?? null;
}

/**
 * Start listening. Returns false when another instance already owns the lock,
 * in which case this process has handed its arguments over and must quit —
 * without that, a Windows redirect opens a second copy of the app and the first
 * one waits forever for a callback that went elsewhere.
 */
export function initDeepLinks(onUrl: (url: string) => void): boolean {
  if (!app.requestSingleInstanceLock()) return false;

  // macOS delivers the URL as an event, and it can fire before the app is ready
  // — a cold start triggered by the redirect itself. Buffer until someone asks.
  let buffered: string | null = findDeepLink(process.argv);

  app.on('open-url', (event, url) => {
    event.preventDefault();
    if (url.startsWith(PREFIX)) deliver(url);
  });

  // Windows and Linux relaunch the binary with the URL in argv; the running
  // instance receives it here because of the single-instance lock above.
  app.on('second-instance', (_event, argv) => {
    const url = findDeepLink(argv);
    if (url) deliver(url);
  });

  let ready = false;
  function deliver(url: string): void {
    if (!ready) {
      buffered = url;
      return;
    }
    onUrl(url);
  }

  app.whenReady().then(() => {
    ready = true;
    if (buffered) {
      const url = buffered;
      buffered = null;
      onUrl(url);
    }
  });

  return true;
}
