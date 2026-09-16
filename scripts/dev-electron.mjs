#!/usr/bin/env node
/**
 * Launches Electron for development — through a real app bundle on macOS.
 *
 * macOS routes a URL scheme by bundle identifier, and `electron .` runs inside
 * Electron's own bundle, `com.github.Electron`. That identifier is not ours to
 * claim (several shipped apps carry a copy of it), so a development run can
 * neither receive the OAuth callback nor register for it without taking the
 * scheme away from the installed app and handing it to a stray Electron.
 *
 * The way out is to give development its own bundle: a clone of Electron.app
 * with our identifier and the scheme in its Info.plist. LaunchServices can then
 * route `git-desktop-auth://` to the running dev process like it would to any
 * installed app.
 *
 * Elsewhere the plain binary is already correct — Windows and Linux route by
 * executable path, which `registerProtocol` passes explicitly.
 */
import { execFileSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUNDLE_ID = 'com.gitdesktop.app.dev';
const SCHEME = 'git-desktop-auth';
const BUNDLE = path.join(root, '.dev-bundle', 'Git Desktop Dev.app');
/** The wrapper, not Electron itself: a cold start has to know what to run. */
const LAUNCHER = 'git-desktop-dev';

function electronAppPath() {
  return path.join(root, 'node_modules', 'electron', 'dist', 'Electron.app');
}

/**
 * The Info.plist for the clone.
 *
 * Written whole rather than edited: the keys that matter are few, and a
 * hand-rolled edit of Electron's own plist would drift the moment Electron
 * changes it.
 */
function infoPlist() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleIdentifier</key><string>${BUNDLE_ID}</string>
  <key>CFBundleName</key><string>Git Desktop Dev</string>
  <key>CFBundleDisplayName</key><string>Git Desktop Dev</string>
  <key>CFBundleExecutable</key><string>${LAUNCHER}</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
  <key>CFBundleShortVersionString</key><string>0.0.0-dev</string>
  <key>CFBundleVersion</key><string>0.0.0-dev</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>LSMinimumSystemVersion</key><string>10.15</string>
  <key>CFBundleURLTypes</key>
  <array>
    <dict>
      <key>CFBundleTypeRole</key><string>Editor</string>
      <key>CFBundleURLName</key><string>Git Desktop Auth (dev)</string>
      <key>CFBundleURLSchemes</key><array><string>${SCHEME}</string></array>
    </dict>
  </array>
</dict>
</plist>
`;
}

/**
 * The bundle's executable: a shell wrapper that starts Electron on this
 * project.
 *
 * Needed because the OS may launch this bundle cold — the browser redirecting
 * back while nothing is running — and it launches it with no arguments. Bare
 * Electron with nothing to run shows its welcome screen, which is the very
 * symptom this whole arrangement exists to stop.
 */
function launcherScript() {
  return `#!/bin/sh
exec "$(dirname "$0")/Electron" ${JSON.stringify(root)} "$@"
`;
}

function buildBundle() {
  const source = electronAppPath();
  if (!fs.existsSync(source)) {
    throw new Error(`Electron is not installed at ${source} — run npm install`);
  }

  fs.rmSync(BUNDLE, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(BUNDLE), { recursive: true });
  // -c asks APFS to clone: instant, and it costs no additional disk space.
  // Older filesystems fall back to a real copy.
  try {
    execFileSync('cp', ['-Rc', source, BUNDLE], { stdio: 'pipe' });
  } catch {
    execFileSync('cp', ['-R', source, BUNDLE], { stdio: 'pipe' });
  }

  fs.writeFileSync(path.join(BUNDLE, 'Contents', 'Info.plist'), infoPlist());
  const launcher = path.join(BUNDLE, 'Contents', 'MacOS', LAUNCHER);
  fs.writeFileSync(launcher, launcherScript(), { mode: 0o755 });

  // Rewriting Info.plist breaks the seal on the bundle, and macOS refuses to
  // launch a bundle whose signature does not check out. Ad-hoc is enough: this
  // never leaves the machine that built it.
  execFileSync('codesign', ['--force', '--sign', '-', BUNDLE], { stdio: 'pipe' });

  // Tell LaunchServices the bundle exists now, rather than whenever it next
  // rescans — otherwise the first sign-in of a session goes nowhere.
  const lsregister =
    '/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/' +
    'LaunchServices.framework/Versions/A/Support/lsregister';
  try {
    execFileSync(lsregister, ['-f', BUNDLE], { stdio: 'pipe' });
  } catch {
    // Not fatal: the app claims the scheme itself once it is running.
  }

  return launcher;
}

function main() {
  const args = process.argv.slice(2).filter(a => a !== '--build-only');
  // Building without launching: what CI and a quick sanity check want.
  if (process.argv.includes('--build-only')) {
    if (process.platform !== 'darwin') return;
    console.log(buildBundle());
    return;
  }
  const command =
    process.platform === 'darwin'
      ? buildBundle()
      : path.join(root, 'node_modules', '.bin', 'electron');
  const commandArgs = process.platform === 'darwin' ? args : [root, ...args];

  if (process.platform === 'darwin') {
    console.log(`[dev] running as ${BUNDLE_ID} so ${SCHEME}:// reaches this process`);
  }

  const child = spawn(command, commandArgs, { stdio: 'inherit', env: process.env });
  child.on('exit', code => process.exit(code ?? 0));
}

main();
