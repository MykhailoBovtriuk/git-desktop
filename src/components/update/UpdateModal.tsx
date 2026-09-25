import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useUpdateStore } from '../../stores/update-store';
import { appApi } from '../../api/app-api';
import { Button, DownloadIcon, Modal } from '../../shared/ui';
import { formatBytes, updateErrorText } from './update-text';

/**
 * The startup offer, and the download it turns into.
 *
 * One dialog through every phase rather than a dialog per phase: "update",
 * "downloading" and "ready" are the same decision in progress, and swapping
 * panels would read as starting over.
 */
export function UpdateModal() {
  const { t } = useTranslation('update');
  const {
    modalOpen,
    phase,
    result,
    progress,
    downloadedVersion,
    error,
    startDownload,
    cancelDownload,
    install,
    later,
    skip,
  } = useUpdateStore(
    useShallow(s => ({
      modalOpen: s.modalOpen,
      phase: s.phase,
      result: s.result,
      progress: s.progress,
      downloadedVersion: s.downloadedVersion,
      error: s.error,
      startDownload: s.startDownload,
      cancelDownload: s.cancelDownload,
      install: s.install,
      later: s.later,
      skip: s.skip,
    })),
  );

  if (!modalOpen) return null;

  const latest = result?.latest ?? null;
  const releaseUrl = latest?.releaseUrl ?? result?.current?.releaseUrl ?? null;
  const openRelease = () => {
    if (releaseUrl) void appApi.openExternal(releaseUrl).catch(() => {});
  };
  const platform = window.electronAPI.platform;

  if (phase === 'downloading') {
    const total = progress?.totalBytes ?? 0;
    return (
      <Modal
        title={t('modal.downloadingTitle', { version: progress?.version ?? latest?.version })}
        width="w-[28rem]"
        onClose={later}
        footer={
          <Button variant="secondary" size="sm" onClick={() => void cancelDownload()}>
            {t('common:cancel')}
          </Button>
        }
      >
        <div className="flex flex-col gap-2">
          <div className="h-1.5 bg-surface2 rounded overflow-hidden">
            {/* Without a Content-Length there is no percentage to draw, so the
                bar says "working" instead of pretending to know. */}
            <div
              className={
                total === 0
                  ? 'h-full w-full bg-blue rounded animate-pulse'
                  : 'h-full bg-blue rounded'
              }
              style={total === 0 ? undefined : { width: `${progress?.percent ?? 0}%` }}
            />
          </div>
          {progress && (
            <p className="text-subtext text-xs">
              {total === 0
                ? formatBytes(progress.receivedBytes)
                : t('modal.progress', {
                    received: formatBytes(progress.receivedBytes),
                    total: formatBytes(total),
                  })}
            </p>
          )}
        </div>
      </Modal>
    );
  }

  if (phase === 'ready') {
    const body =
      platform === 'win32'
        ? t('modal.readyBodyWin')
        : platform === 'darwin'
          ? t('modal.readyBodyMac')
          : t('modal.readyBodyLinux');
    return (
      <Modal
        title={t('modal.readyTitle')}
        subtitle={downloadedVersion ? t('downloaded', { version: downloadedVersion }) : undefined}
        width="w-[28rem]"
        onClose={later}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={later}>
              {t('modal.later')}
            </Button>
            <Button variant="primary" size="sm" onClick={() => void install()}>
              {platform === 'linux' ? t('reveal') : t('modal.installNow')}
            </Button>
          </>
        }
      >
        <p className="text-subtext text-sm">{body}</p>
        {error && <p className="text-red text-xs mt-2">{updateErrorText(t, error)}</p>}
      </Modal>
    );
  }

  if (phase === 'error') {
    return (
      <Modal
        title={t('title')}
        width="w-[28rem]"
        onClose={later}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={later}>
              {t('modal.later')}
            </Button>
            {releaseUrl && (
              <Button variant="primary" size="sm" onClick={openRelease}>
                {t('modal.openRelease')}
              </Button>
            )}
          </>
        }
      >
        {error && <p className="text-red text-xs">{updateErrorText(t, error)}</p>}
      </Modal>
    );
  }

  // Checking again, or found nothing: there is no offer to make right now.
  if (phase !== 'available' || !latest) return null;

  // A dev run, or a machine the release has no installer for, can still be
  // told a new version exists — it just gets the page instead of a download.
  const canDownload = !!result?.canInstall && !!latest.assetName;

  return (
    <Modal
      title={t('modal.title')}
      subtitle={t('modal.subtitle', { version: latest.version, current: result?.currentVersion })}
      width="w-[28rem]"
      onClose={later}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={skip}>
            {t('modal.skip')}
          </Button>
          <Button variant="secondary" size="sm" onClick={later}>
            {t('modal.later')}
          </Button>
          {canDownload ? (
            <Button
              variant="primary"
              size="sm"
              className="inline-flex items-center gap-1.5"
              onClick={() => void startDownload(latest.version)}
            >
              <DownloadIcon size={12} aria-hidden="true" />
              {t('modal.update')}
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={openRelease}>
              {t('modal.openRelease')}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-2 mb-2">
        {latest.notes.trim() && (
          <>
            <p className="text-text text-xs font-medium">{t('modal.notes')}</p>
            <div className="max-h-48 overflow-y-auto text-subtext text-xs whitespace-pre-wrap bg-mantle rounded p-2">
              {latest.notes.trim()}
            </div>
          </>
        )}
        {canDownload && latest.assetSize > 0 && (
          <p className="text-subtext text-xs">
            {t('modal.size', { size: formatBytes(latest.assetSize) })}
          </p>
        )}
      </div>
    </Modal>
  );
}
