#!/usr/bin/env node
/**
 * node-pty's macOS/Linux prebuilds ship `spawn-helper` without the execute bit
 * once npm unpacks them, and every spawn then fails with "posix_spawnp failed".
 * Restored here so both dev runs and packaged builds get a runnable helper.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pty = path.join(root, 'node_modules', 'node-pty');

if (process.platform !== 'win32' && fs.existsSync(pty)) {
  const dirs = [path.join(pty, 'build', 'Release')];
  const prebuilds = path.join(pty, 'prebuilds');
  if (fs.existsSync(prebuilds)) {
    for (const name of fs.readdirSync(prebuilds)) dirs.push(path.join(prebuilds, name));
  }
  for (const dir of dirs) {
    const helper = path.join(dir, 'spawn-helper');
    if (fs.existsSync(helper)) fs.chmodSync(helper, 0o755);
  }
}
