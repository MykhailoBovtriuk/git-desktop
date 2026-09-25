import { app, shell } from 'electron';
import { spawn } from 'child_process';
import fs from 'fs/promises';

/**
 * Long enough for the installer to be up, short enough that the app does not
 * look stuck. Quitting is not optional on Windows: NSIS cannot replace files
 * this process is holding open.
 */
const QUIT_DELAY_MS = 1_000;
/** macOS gets a moment longer: the dmg is still mounting behind the dialog. */
const MAC_QUIT_DELAY_MS = 2_000;

/**
 * Hand the downloaded artifact to the platform that knows what to do with it.
 *
 * Only Windows and macOS lead anywhere: a .deb needs root and an AppImage is a
 * file the user moves themselves, so on Linux the honest ending is showing the
 * file and staying out of the way.
 */
export async function launchInstaller(
  filePath: string,
  platform: string = process.platform,
): Promise<void> {
  // The download happened minutes ago and lives in a folder the user can empty.
  await fs.stat(filePath);

  if (platform === 'win32') {
    // No shell: the path goes to the process, never through a command line.
    const child = spawn(filePath, [], { detached: true, stdio: 'ignore' });
    child.unref();
    setTimeout(() => app.quit(), QUIT_DELAY_MS);
    return;
  }

  if (platform === 'darwin') {
    const error = await shell.openPath(filePath);
    if (error) throw new Error(error);
    // Finder cannot replace the bundle of a running app in any way that ends
    // well, so we are gone before the user drags anything.
    setTimeout(() => app.quit(), MAC_QUIT_DELAY_MS);
    return;
  }

  // An AppImage arrives without the executable bit; setting it here saves the
  // user the one step they would otherwise have to discover.
  if (filePath.toLowerCase().endsWith('.appimage')) {
    await fs.chmod(filePath, 0o755);
  }
  shell.showItemInFolder(filePath);
}
