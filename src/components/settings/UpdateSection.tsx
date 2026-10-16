import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useUpdateStore } from '../../stores/update-store';
import { useSettingsStore } from '../../stores/settings-store';
import { appApi } from '../../api/app-api';
import { useAppVersion } from '../../hooks/use-app-version';
import { Button, DownloadIcon, Switch, TruncatedText } from '../../shared/ui';
import { updateErrorText } from '../update/update-text';
import { SettingsSection } from './SettingsSection';

export function UpdateSection() {
  const { t } = useTranslation('update');
  const {
    phase,
    result,
    progress,
    downloadedVersion,
    error,
    check,
    startDownload,
    cancelDownload,
    install,
  } = useUpdateStore(
    useShallow(s => ({
      phase: s.phase,
      result: s.result,
      progress: s.progress,
      downloadedVersion: s.downloadedVersion,
      error: s.error,
      check: s.check,
      startDownload: s.startDownload,
      cancelDownload: s.cancelDownload,
      install: s.install,
    })),
  );
  const { autoCheckUpdates, setAutoCheckUpdates, includePrereleases, setIncludePrereleases } =
    useSettingsStore(
      useShallow(s => ({
        autoCheckUpdates: s.autoCheckUpdates,
        setAutoCheckUpdates: s.setAutoCheckUpdates,
        includePrereleases: s.includePrereleases,
        setIncludePrereleases: s.setIncludePrereleases,
      })),
    );

  const appVersion = useAppVersion();

  const version = result?.currentVersion ?? appVersion;
  const latest = result?.latest ?? null;
  const busy = phase === 'checking' || phase === 'downloading';
  const canDownload = !!result?.canInstall && !!latest?.assetName;

  const status =
    phase === 'checking'
      ? t('checking')
      : phase === 'downloading'
        ? t('downloading', { percent: Math.round(progress?.percent ?? 0) })
        : phase === 'ready' && downloadedVersion
          ? t('downloaded', { version: downloadedVersion })
          : phase === 'available' && latest
            ? t('available', { version: latest.version })
            : phase === 'idle' && result?.status === 'up-to-date'
              ? t('upToDate')
              : null;

  const openRelease = () => {
    if (latest) void appApi.openExternal(latest.releaseUrl).catch(() => {});
  };

  const action = (() => {
    if (phase === 'ready') {
      return (
        <Button variant="primary" size="sm" onClick={() => void install()}>
          {window.electronAPI.platform === 'linux' ? t('reveal') : t('install')}
        </Button>
      );
    }
    if (phase === 'available' && latest) {
      return canDownload ? (
        <Button
          variant="primary"
          size="sm"
          className="inline-flex items-center gap-1.5"
          onClick={() => void startDownload(latest.version)}
        >
          <DownloadIcon size={12} aria-hidden="true" />
          {t('update')}
        </Button>
      ) : (
        <Button variant="primary" size="sm" onClick={openRelease}>
          {t('modal.openRelease')}
        </Button>
      );
    }
    if (phase === 'downloading') {
      return (
        <Button variant="secondary" size="sm" onClick={() => void cancelDownload()}>
          {t('common:cancel')}
        </Button>
      );
    }
    return (
      <Button
        variant="secondary"
        size="sm"
        disabled={busy}
        onClick={() => void check({ force: true })}
      >
        {t('check')}
      </Button>
    );
  })();

  return (
    <>
      <p className="text-subtext text-xs pt-1">{t('hint')}</p>

      <section className="py-4 border-b border-surface0">
        <div className="bg-mantle rounded p-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-text text-sm">{version ? t('currentVersion', { version }) : ''}</p>
            {status && (
              <TruncatedText as="p" className="text-subtext text-xs">
                {status}
              </TruncatedText>
            )}
          </div>
          {action}
        </div>

        {phase === 'downloading' && (
          <div className="h-1.5 bg-surface2 rounded overflow-hidden mt-2">
            <div
              className={
                progress?.totalBytes
                  ? 'h-full bg-blue rounded'
                  : 'h-full w-full bg-blue rounded animate-pulse'
              }
              style={progress?.totalBytes ? { width: `${progress.percent}%` } : undefined}
            />
          </div>
        )}

        {error && <p className="text-red text-xs mt-2">{updateErrorText(t, error)}</p>}
      </section>

      <SettingsSection title={t('autoCheck')} description={t('autoCheckHint')}>
        <Switch
          checked={autoCheckUpdates}
          onToggle={() => setAutoCheckUpdates(!autoCheckUpdates)}
          label={t('autoCheck')}
          hideLabel
        />
      </SettingsSection>

      <SettingsSection title={t('includePrerelease')} description={t('includePrereleaseHint')}>
        <Switch
          checked={includePrereleases}
          onToggle={() => setIncludePrereleases(!includePrereleases)}
          label={t('includePrerelease')}
          hideLabel
        />
      </SettingsSection>

      <SettingsSection title={t('reinstall')} description={t('reinstallHint')}>
        <Button
          variant="surface"
          size="sm"
          disabled={busy || !result?.current || !result.canInstall}
          onClick={() => result?.current && void startDownload(result.current.version)}
        >
          {t('reinstall')}
        </Button>
      </SettingsSection>
    </>
  );
}
