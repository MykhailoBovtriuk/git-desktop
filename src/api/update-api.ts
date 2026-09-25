import { invoke } from './invoke';
import type { DownloadedUpdate, UpdateCheckResult, UpdateProgress } from '../types';

export const updateApi = {
  check: (includePrerelease: boolean, force: boolean) =>
    invoke<UpdateCheckResult>('app:check-for-update', includePrerelease, force),
  download: (version: string) => invoke<DownloadedUpdate>('app:download-update', version),
  cancelDownload: () => invoke<null>('app:cancel-update-download'),
  install: () => invoke<null>('app:install-update'),
  /** Returns the unsubscribe, like the other pushes. */
  onProgress: (cb: (progress: UpdateProgress) => void) =>
    window.electronAPI.onUpdateProgress(cb),
};
