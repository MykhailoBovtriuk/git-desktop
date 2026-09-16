import { app } from 'electron';
import fs from 'fs';
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
 *
 * Except on macOS, which does not take a path at all: it resolves a scheme
 * through a bundle identifier. Claiming a scheme the running bundle does not
 * declare points the OS at that bundle's identifier whatever it happens to be,
 * and for a plain `electron .` that identifier is `com.github.Electron` —
 * which any number of shipped apps carry a copy of (DaVinci Resolve bundles
 * one). The callback then lands in a stray Electron's welcome screen, and the
 * preference is system-wide and sticky, so one `npm run dev` also takes the
 * callback away from the installed app. Hence the Info.plist check rather than
 * a plain "are we packaged": the dev bundle `scripts/dev-electron.mjs` builds
 * declares the scheme too, and is a legitimate owner of it.
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
 * Whether the macOS bundle this process runs from declares the scheme in its
 * Info.plist — the only claim the OS actually honours.
 *
 * Read, not parsed: the scheme is stored as plain text in both the XML and the
 * binary plist forms, and a plist parser would be a dependency carried for one
 * substring.
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
