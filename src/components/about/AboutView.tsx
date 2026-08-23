import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '../../stores/ui-store';
import { appApi } from '../../api/app-api';
import { PageHeader } from '../layout/PageHeader';
import { Badge, Button } from '../../shared/ui';

const REPO_URL = 'https://github.com/MykhailoBovtriuk/git-desktop';

const LINKS = [
  { key: 'sourceCode', url: REPO_URL },
  { key: 'reportIssue', url: `${REPO_URL}/issues` },
  { key: 'releases', url: `${REPO_URL}/releases` },
  { key: 'license', url: `${REPO_URL}/blob/main/LICENSE` },
] as const;

const SUPPORT_LINKS = [
  { key: 'star', url: REPO_URL },
  { key: 'sponsor', url: 'https://github.com/sponsors/MykhailoBovtriuk' },
  { key: 'contribute', url: `${REPO_URL}/blob/main/README.md` },
] as const;

export function AboutView() {
  const { t } = useTranslation('about');
  const closeOverlayView = useUiStore(s => s.closeOverlayView);
  const addToast = useUiStore(s => s.addToast);
  const [version, setVersion] = useState('');

  useEffect(() => {
    let active = true;
    appApi
      .getVersion()
      .then(v => {
        if (active) setVersion(v);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const open = (url: string) => {
    appApi.openExternal(url).catch((err: unknown) => {
      addToast({
        variant: 'error',
        title: t('title'),
        message: err instanceof Error ? err.message : String(err),
      });
    });
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-base">
      <PageHeader title={t('title')} onBack={closeOverlayView} />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-6 flex flex-col gap-6">
          <header className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-text text-xl font-bold">Git Desktop</h2>
              <Badge variant="beta">Beta</Badge>
              {version && <span className="text-subtext text-xs font-mono">v{version}</span>}
            </div>
            <p className="text-subtext text-sm">{t('tagline')}</p>
          </header>

          <section className="flex flex-col gap-2">
            <h3 className="text-text text-sm font-medium">{t('whatIsIt')}</h3>
            <p className="text-subtext text-sm leading-relaxed">{t('description')}</p>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-text text-sm font-medium">{t('support')}</h3>
            <p className="text-subtext text-sm leading-relaxed">{t('supportHint')}</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {SUPPORT_LINKS.map(link => (
                <Button key={link.key} variant="surface" size="sm" onClick={() => open(link.url)}>
                  {t(`links.${link.key}`)}
                </Button>
              ))}
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-text text-sm font-medium">{t('project')}</h3>
            <div className="flex flex-wrap gap-2">
              {LINKS.map(link => (
                <Button key={link.key} variant="surface" size="sm" onClick={() => open(link.url)}>
                  {t(`links.${link.key}`)}
                </Button>
              ))}
            </div>
          </section>

          <footer className="text-subtext text-xs border-t border-surface0 pt-4">
            {t('credits')}
          </footer>
        </div>
      </div>
    </div>
  );
}
