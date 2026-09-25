import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

const quit = vi.fn();
const openPath = vi.fn((_filePath: string) => Promise.resolve(''));
const showItemInFolder = vi.fn();
const spawn = vi.fn(() => ({ unref: vi.fn() }));

vi.mock('electron', () => ({
  app: { quit: () => quit() },
  shell: {
    openPath: (p: string) => openPath(p),
    showItemInFolder: (p: string) => showItemInFolder(p),
  },
}));

vi.mock('child_process', () => ({
  spawn: (...args: unknown[]) => spawn(...(args as [])),
}));

const { launchInstaller } = await import('../../electron/update/install');

let dir: string;

const fileNamed = async (name: string) => {
  const target = path.join(dir, name);
  await fs.writeFile(target, 'installer');
  return target;
};

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'git-desktop-install-'));
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(async () => {
  vi.useRealTimers();
  await fs.rm(dir, { recursive: true, force: true });
});

describe('launchInstaller', () => {
  it('refuses a file that is no longer there', async () => {
    await expect(launchInstaller(path.join(dir, 'gone.dmg'), 'darwin')).rejects.toThrow();
    expect(openPath).not.toHaveBeenCalled();
  });

  // NSIS cannot replace files this process holds open, so leaving is part of
  // installing, not an afterthought.
  it('starts the Windows installer detached and then quits', async () => {
    const file = await fileNamed('Git-Desktop-Setup-x64-1.2.0.exe');

    await launchInstaller(file, 'win32');

    expect(spawn).toHaveBeenCalledWith(file, [], { detached: true, stdio: 'ignore' });
    expect(quit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_000);
    expect(quit).toHaveBeenCalledTimes(1);
  });

  it('mounts the dmg and gets out of Finder way', async () => {
    const file = await fileNamed('Git-Desktop-arm64-1.2.0.dmg');

    await launchInstaller(file, 'darwin');

    expect(openPath).toHaveBeenCalledWith(file);
    vi.advanceTimersByTime(2_000);
    expect(quit).toHaveBeenCalledTimes(1);
  });

  it('reports a dmg that refused to open, and stays running', async () => {
    openPath.mockResolvedValueOnce('no mountable file systems');
    const file = await fileNamed('Git-Desktop-arm64-1.2.0.dmg');

    await expect(launchInstaller(file, 'darwin')).rejects.toThrow(/no mountable/);
    vi.advanceTimersByTime(5_000);
    expect(quit).not.toHaveBeenCalled();
  });

  it('makes an AppImage executable, shows it, and keeps running', async () => {
    const file = await fileNamed('git-desktop-x86_64-1.2.0.AppImage');

    await launchInstaller(file, 'linux');

    expect((await fs.stat(file)).mode & 0o111).toBeTruthy();
    expect(showItemInFolder).toHaveBeenCalledWith(file);
    vi.advanceTimersByTime(5_000);
    expect(quit).not.toHaveBeenCalled();
  });

  // A .deb needs root; pretending to install it would fail silently.
  it('only shows a deb', async () => {
    const file = await fileNamed('git-desktop-amd64-1.2.0.deb');

    await launchInstaller(file, 'linux');

    expect((await fs.stat(file)).mode & 0o111).toBe(0);
    expect(showItemInFolder).toHaveBeenCalledWith(file);
  });
});
