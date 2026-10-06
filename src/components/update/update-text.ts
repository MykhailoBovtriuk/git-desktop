import type { TFunction } from 'i18next';

/**
 * Maps the update tokens onto the `update` namespace; anything else is a real
 * message shown as-is.
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
