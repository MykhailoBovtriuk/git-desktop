import type { TFunction } from 'i18next';

/**
 * The tokens the main process and the update store send instead of prose,
 * mapped onto the `update` namespace. Anything else is a real message (a
 * failed HTTP status, a size mismatch) and is shown as it came.
 */
const ERROR_KEYS: Record<string, string> = {
  offline: 'errors.offline',
  'rate-limited': 'errors.rateLimited',
  'no-asset': 'errors.noAsset',
  'no-release': 'errors.noRelease',
  'no-download': 'errors.noDownload',
  'download-in-progress': 'errors.busy',
  'repo-busy': 'errors.repoBusy',
  'dev-build': 'errors.devBuild',
};

export function updateErrorText(t: TFunction, error: string): string {
  const key = ERROR_KEYS[error];
  return key ? t(key) : error || t('errors.downloadFailed');
}

/** Installers run 100–150 MB, so one decimal of MB is the useful precision. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
