#!/usr/bin/env node
/**
 * After electron-builder: every unpacked app in release/ must carry node-pty
 * outside the asar, and the one built for this machine's arch must load it the
 * way the app does and start a shell. Windows ia32 is exempt: no prebuild exists, the app shows a
 * placeholder there by design.
 */
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const release = path.join(root, 'release');

function findUnpacked(dir, depth = 0, out = []) {
  if (depth > 6 || !fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const full = path.join(dir, entry.name);
    if (entry.name === 'app.asar.unpacked') out.push(full);
    else findUnpacked(full, depth + 1, out);
  }
  return out;
}

const archOf = dir => {
  const rel = path.relative(release, dir);
  if (/ia32/.test(rel)) return 'ia32';
  if (/arm64/.test(rel)) return 'arm64';
  return 'x64';
};

const unpacked = findUnpacked(release);
if (unpacked.length === 0) {
  console.error('No app.asar.unpacked found under release/');
  process.exit(1);
}

/** The app's own executable: loading through it is what the real main process does. */
function executableFor(unpackedDir) {
  const resources = path.dirname(unpackedDir);
  const candidates =
    process.platform === 'darwin'
      ? fs
          .readdirSync(path.join(resources, '..', 'MacOS'))
          .map(n => path.join(resources, '..', 'MacOS', n))
      : fs
          .readdirSync(path.join(resources, '..'))
          .map(n => path.join(resources, '..', n))
          .filter(f =>
            process.platform === 'win32'
              ? /Git Desktop\.exe$/i.test(f)
              : path.basename(f) === 'git-desktop',
          );
  return candidates.find(f => fs.statSync(f).isFile()) ?? null;
}

// Runs inside the packaged Electron in Node mode, requiring node-pty through
// app.asar exactly like main does, so asar redirection and spawn-helper are
// exercised for real.
const PROBE = `
const pty = require(process.argv[2]);
const win = process.platform === 'win32';
let text = '';
const term = pty.spawn(win ? 'cmd.exe' : '/bin/sh', win ? ['/c', 'echo ok'] : ['-c', 'echo ok'],
  { cols: 80, rows: 24, cwd: process.cwd(), env: process.env });
term.onData(d => (text += d));
term.onExit(() => { process.stdout.write(text); process.exit(text.includes('ok') ? 0 : 2); });
setTimeout(() => { console.error('timed out'); process.exit(3); }, 10000);
`;

let failed = false;
for (const dir of unpacked) {
  const arch = archOf(dir);
  const ptyDir = path.join(dir, 'node_modules', 'node-pty');
  if (!fs.existsSync(ptyDir)) {
    console.error(`✗ ${dir}: node-pty is missing`);
    failed = true;
    continue;
  }
  if (arch !== process.arch) {
    console.log(`• ${dir}: present (${arch}, not loadable on ${process.arch})`);
    continue;
  }
  const exe = executableFor(dir);
  if (!exe) {
    console.error(`✗ ${dir}: app executable not found`);
    failed = true;
    continue;
  }
  const probe = path.join(os.tmpdir(), `pty-probe-${process.pid}.js`);
  fs.writeFileSync(probe, PROBE);
  const asarModule = path.join(path.dirname(dir), 'app.asar', 'node_modules', 'node-pty');
  const result = spawnSync(exe, [probe, asarModule], {
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    encoding: 'utf8',
    timeout: 20_000,
  });
  fs.rmSync(probe, { force: true });
  if (result.status === 0) {
    console.log(`✓ ${dir}: loads through app.asar and spawns (${arch})`);
  } else {
    console.error(`✗ ${dir}: exit ${result.status}\n${result.stdout}\n${result.stderr}`);
    failed = true;
  }
}
process.exit(failed ? 1 : 0);
