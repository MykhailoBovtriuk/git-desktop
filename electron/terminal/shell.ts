import fs from 'fs';
import path from 'path';
import type { TerminalShell } from '../../src/types';

/** What shell detection reads from the machine; swapped out in tests. */
export interface ShellSystem {
  platform: NodeJS.Platform;
  env: NodeJS.ProcessEnv;
  exists: (file: string) => boolean;
}

export interface ShellSpec extends TerminalShell {
  path: string;
  args: string[];
}

const realSystem = (): ShellSystem => ({
  platform: process.platform,
  env: process.env,
  exists: file => {
    try {
      return fs.statSync(file).isFile();
    } catch {
      return false;
    }
  },
});

function which(name: string, sys: ShellSystem): string | null {
  const win = sys.platform === 'win32';
  const lib = win ? path.win32 : path.posix;
  const raw = sys.env.PATH ?? sys.env.Path ?? '';
  for (const dir of raw.split(win ? ';' : ':')) {
    if (!dir) continue;
    const file = lib.join(dir, name);
    if (sys.exists(file)) return file;
  }
  return null;
}

function posixShells(sys: ShellSystem): ShellSpec[] {
  const candidates = [sys.env.SHELL, '/bin/zsh', '/bin/bash', '/usr/bin/fish', '/bin/sh'];
  const seen = new Set<string>();
  const out: ShellSpec[] = [];
  for (const file of candidates) {
    if (!file || !sys.exists(file)) continue;
    const name = path.posix.basename(file);
    if (seen.has(name)) continue;
    seen.add(name);
    // A login shell reads ~/.zprofile and friends: an app started from the
    // Dock otherwise gets a PATH without Homebrew, nvm or pyenv.
    out.push({ id: name, label: name, path: file, args: ['-l'] });
  }
  return out;
}

function windowsShells(sys: ShellSystem): ShellSpec[] {
  const lib = path.win32;
  const root = sys.env.SystemRoot ?? sys.env.windir ?? 'C:\\Windows';
  const system32 = lib.join(root, 'System32');
  const out: ShellSpec[] = [];
  const add = (spec: ShellSpec | null) => spec && out.push(spec);

  const pwsh = which('pwsh.exe', sys);
  add(pwsh ? { id: 'pwsh', label: 'PowerShell', path: pwsh, args: ['-NoLogo'] } : null);

  const legacy = lib.join(system32, 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  const powershell = sys.exists(legacy) ? legacy : which('powershell.exe', sys);
  add(
    powershell
      ? { id: 'powershell', label: 'Windows PowerShell', path: powershell, args: ['-NoLogo'] }
      : null,
  );

  const cmd =
    (sys.env.ComSpec && sys.exists(sys.env.ComSpec) ? sys.env.ComSpec : null) ??
    (sys.exists(lib.join(system32, 'cmd.exe')) ? lib.join(system32, 'cmd.exe') : null);
  add(cmd ? { id: 'cmd', label: 'Command Prompt', path: cmd, args: [] } : null);

  const gitBash = [
    sys.env.ProgramFiles && lib.join(sys.env.ProgramFiles, 'Git', 'bin', 'bash.exe'),
    sys.env['ProgramFiles(x86)'] &&
      lib.join(sys.env['ProgramFiles(x86)'], 'Git', 'bin', 'bash.exe'),
    sys.env.LOCALAPPDATA && lib.join(sys.env.LOCALAPPDATA, 'Programs', 'Git', 'bin', 'bash.exe'),
  ].find((file): file is string => !!file && sys.exists(file));
  add(
    gitBash ? { id: 'git-bash', label: 'Git Bash', path: gitBash, args: ['--login', '-i'] } : null,
  );

  const wsl = lib.join(system32, 'wsl.exe');
  add(sys.exists(wsl) ? { id: 'wsl', label: 'WSL', path: wsl, args: [] } : null);

  return out;
}

/** Shells found on this machine, the preferred one first. */
export function detectShells(sys: ShellSystem = realSystem()): ShellSpec[] {
  return sys.platform === 'win32' ? windowsShells(sys) : posixShells(sys);
}

/** `id` when it names a detected shell, the first detected one otherwise. */
export function pickShell(shells: ShellSpec[], id?: string | null): ShellSpec | null {
  return shells.find(s => s.id === id) ?? shells[0] ?? null;
}

/**
 * The app's own environment minus what only makes sense for its git calls:
 * here a person is at the keyboard and can answer a password prompt.
 */
export function terminalEnv(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) continue;
    if (key === 'GIT_TERMINAL_PROMPT' || key === 'GIT_ASKPASS') continue;
    if (key.startsWith('ELECTRON_') || key === 'VITE_DEV_SERVER_URL') continue;
    out[key] = value;
  }
  out.TERM = 'xterm-256color';
  out.COLORTERM = 'truecolor';
  out.TERM_PROGRAM = 'git-desktop';
  // Apps launched from Finder get no locale, and zsh then mangles anything
  // outside ASCII.
  if (platform === 'darwin' && !out.LANG) out.LANG = 'en_US.UTF-8';
  return out;
}
