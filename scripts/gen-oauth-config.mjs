#!/usr/bin/env node
/**
 * Bakes the OAuth client ids (and the two secrets that cannot be avoided) into
 * the build.
 *
 * `tsc` performs no substitution, so the values cannot live in a .ts file the
 * way a Vite `define` would allow. They are written as JSON next to the compiled
 * main process instead, which electron-builder already ships via `dist-electron/**`.
 *
 * Missing values are not an error: a fork without secrets still builds and runs,
 * it simply offers personal-access-token sign-in instead of the browser flow.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// A local .env.local keeps developers from having to export seven variables in
// every shell. Deliberately minimal: KEY=value, # comments, no quoting rules.
function loadEnvFile() {
  const file = path.join(root, '.env.local');
  if (!fs.existsSync(file)) return {};
  const out = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return out;
}

const VARS = [
  'OAUTH_GITHUB_ID',
  'OAUTH_GITHUB_SECRET',
  'OAUTH_GITLAB_ID',
  'OAUTH_AZURE_ID',
  'OAUTH_BITBUCKET_ID',
  'OAUTH_BITBUCKET_SECRET',
  'OAUTH_GITEA_ID',
];

const fromFile = loadEnvFile();
const keys = {};
for (const name of VARS) {
  const value = process.env[name] ?? fromFile[name] ?? '';
  if (value) keys[name] = value;
}

const outDir = path.join(root, 'dist-electron');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'oauth-keys.json'), JSON.stringify(keys, null, 2) + '\n');

const found = Object.keys(keys);
console.log(
  found.length
    ? `[oauth] baked ${found.length}/${VARS.length} keys: ${found.join(', ')}`
    : '[oauth] no keys found — this build offers token sign-in only',
);
