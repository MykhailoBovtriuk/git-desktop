#!/usr/bin/env node
/**
 * Empty the build output before compiling: `tsc` never deletes stale files,
 * which then ship. Node's fs instead of `rm -rf` for Windows.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

for (const dir of ['dist', 'dist-electron']) {
  fs.rmSync(path.join(root, dir), { recursive: true, force: true });
}
