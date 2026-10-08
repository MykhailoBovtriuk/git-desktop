import { describe, it, expect } from 'vitest';
import {
  detectShells,
  pickShell,
  terminalEnv,
  type ShellSystem,
} from '../../electron/terminal/shell';

const sys = (platform: NodeJS.Platform, env: NodeJS.ProcessEnv, files: string[]): ShellSystem => ({
  platform,
  env,
  exists: f => files.includes(f),
});

describe('detectShells', () => {
  it('puts $SHELL first on macOS and Linux and starts it as a login shell', () => {
    const shells = detectShells(
      sys('darwin', { SHELL: '/opt/homebrew/bin/fish' }, [
        '/opt/homebrew/bin/fish',
        '/bin/zsh',
        '/bin/bash',
      ]),
    );
    expect(shells.map(s => s.id)).toEqual(['fish', 'zsh', 'bash']);
    expect(shells[0]).toMatchObject({ path: '/opt/homebrew/bin/fish', args: ['-l'] });
  });

  it('skips shells that are not installed and duplicates of $SHELL', () => {
    const shells = detectShells(sys('linux', { SHELL: '/bin/bash' }, ['/bin/bash', '/bin/sh']));
    expect(shells.map(s => s.path)).toEqual(['/bin/bash', '/bin/sh']);
  });

  it('finds PowerShell 7, Windows PowerShell, cmd, Git Bash and WSL on Windows', () => {
    const env = {
      SystemRoot: 'C:\\Windows',
      ComSpec: 'C:\\Windows\\System32\\cmd.exe',
      ProgramFiles: 'C:\\Program Files',
      Path: 'C:\\Program Files\\PowerShell\\7;C:\\Windows\\System32',
    };
    const shells = detectShells(
      sys('win32', env, [
        'C:\\Program Files\\PowerShell\\7\\pwsh.exe',
        'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
        'C:\\Windows\\System32\\cmd.exe',
        'C:\\Program Files\\Git\\bin\\bash.exe',
        'C:\\Windows\\System32\\wsl.exe',
      ]),
    );
    expect(shells.map(s => s.id)).toEqual(['pwsh', 'powershell', 'cmd', 'git-bash', 'wsl']);
    expect(shells.find(s => s.id === 'git-bash')?.args).toEqual(['--login', '-i']);
  });

  it('falls back to cmd when nothing else is there', () => {
    const shells = detectShells(
      sys('win32', { SystemRoot: 'C:\\Windows' }, ['C:\\Windows\\System32\\cmd.exe']),
    );
    expect(shells.map(s => s.id)).toEqual(['cmd']);
  });
});

describe('pickShell', () => {
  const shells = detectShells(sys('linux', {}, ['/bin/zsh', '/bin/bash']));
  it('honours a known id and ignores an unknown one', () => {
    expect(pickShell(shells, 'bash')?.id).toBe('bash');
    expect(pickShell(shells, '/usr/bin/evil')?.id).toBe('zsh');
    expect(pickShell([], 'bash')).toBeNull();
  });
});

describe('terminalEnv', () => {
  it('drops the app-only git and Electron variables and sets the terminal type', () => {
    const env = terminalEnv(
      { PATH: '/bin', GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: 'echo', ELECTRON_RUN_AS_NODE: '1' },
      'linux',
    );
    expect(env).toEqual({
      PATH: '/bin',
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      TERM_PROGRAM: 'git-desktop',
    });
  });

  it('gives macOS a UTF-8 locale when launched without one', () => {
    expect(terminalEnv({}, 'darwin').LANG).toBe('en_US.UTF-8');
    expect(terminalEnv({ LANG: 'uk_UA.UTF-8' }, 'darwin').LANG).toBe('uk_UA.UTF-8');
  });
});
