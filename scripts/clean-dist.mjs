#!/usr/bin/env node
/**
 * Empty the build output before compiling.
 *
 * `tsc` writes files but never removes them, so a module deleted from the
 * source tree keeps being emitted from a previous run and ends up inside the
 * installer. That is how the removed profiles and auth modules were still
 * shipping long after they left the repository.
 *
 * Node's fs rather than `rm -rf`: this also runs on the Windows release runner.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

for (const dir of ['dist', 'dist-electron']) {
  fs.rmSync(path.join(root, dir), { recursive: true, force: true });
}
