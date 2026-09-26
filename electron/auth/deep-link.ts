import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import { PROTOCOL_SCHEME } from './oauth-config';

/**
 * Getting the browser's redirect back into this process; each platform delivers
 * the URL differently and at a different time.
 */

const PREFIX = `${PROTOCOL_SCHEME}://`;

/**
 * Claim the scheme; on Windows before `app.whenReady()`. On macOS only a bundle
 * declaring it in Info.plist may, or `electron .` steals it from the real app.
 */
export function registerProtocol(): void {
  if (process.platform === 'darwin' && !bundleDeclaresScheme(process.execPath)) return;

  if (process.defaultApp && process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL_SCHEME, process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL_SCHEME);
  }
}

/**
 * Whether this macOS bundle declares the scheme in Info.plist. Read as text,
 * not parsed: both plist forms store it verbatim.
 */
export function bundleDeclaresScheme(execPath: string): boolean {
  try {
    const plist = path.resolve(path.dirname(execPath), '..', 'Info.plist');
    return fs.readFileSync(plist, 'latin1').includes(PROTOCOL_SCHEME);
  } catch {
    // No bundle around this executable, which is an answer rather than a fault.
    return false;
  }
}

export function findDeepLink(argv: string[]): string | null {
  return argv.find(arg => arg.startsWith(PREFIX)) ?? null;
}

/**
 * Start listening. Returns false when another instance holds the lock: this
 * process has forwarded its arguments and must quit.
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
