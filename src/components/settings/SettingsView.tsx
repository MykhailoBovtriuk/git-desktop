import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useUiStore } from '../../stores/ui-store';
import { useRepoStore } from '../../stores/repo-store';
import { useEscapeToClose } from '../../hooks/use-escape-to-close';
import { PageHeader } from '../layout/PageHeader';
import { cn } from '../../shared/ui';
import { CATEGORIES } from './categories';

export function SettingsView() {
  const { t } = useTranslation('settings');
  const { closeOverlays, category, setCategory } = useUiStore(
    useShallow(s => ({
      closeOverlays: s.closeOverlays,
      category: s.settingsCategory,
      setCategory: s.setSettingsCategory,
    })),
  );
  // With a repository open the titlebar's Settings toggle closes the page; the
  // welcome screen has no titlebar, so there the page keeps its own way back.
  const repoOpen = useRepoStore(s => !!s.repoPath);
  useEscapeToClose(closeOverlays);
  const navRef = useRef<HTMLElement>(null);
  const current = CATEGORIES.find(c => c.id === category) ?? CATEGORIES[0];
  const Page = current.Component;

  // Up/Down walk the menu like a list, and focus follows so Enter is not needed.
  const onNavKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const index = CATEGORIES.findIndex(c => c.id === current.id);
    const next =
      CATEGORIES[
        (index + (e.key === 'ArrowDown' ? 1 : -1) + CATEGORIES.length) % CATEGORIES.length
      ];
    setCategory(next.id);
    navRef.current?.querySelector<HTMLButtonElement>(`[data-category="${next.id}"]`)?.focus();
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-base">
      <PageHeader
        crumbs={[
          { label: t('title'), onClick: () => setCategory('general') },
          { label: t(`categories.${current.id}`) },
        ]}
        onBack={repoOpen ? undefined : closeOverlays}
      />

      <div className="flex-1 flex min-h-0">
        <nav
          ref={navRef}
          aria-label={t('title')}
          onKeyDown={onNavKey}
          className="w-48 shrink-0 border-r border-surface0 bg-mantle py-2 overflow-y-auto"
        >
          {CATEGORIES.map(({ id, icon: Icon }) => {
            const active = id === current.id;
            return (
              <button
                key={id}
                type="button"
                data-category={id}
                aria-current={active ? 'page' : undefined}
                onClick={() => setCategory(id)}
                className={cn(
                  'flex items-center gap-2 w-full px-3 py-2 text-left text-sm border-l-2 transition-colors',
                  active
                    ? 'bg-surface0 border-blue text-text'
                    : 'border-transparent text-subtext hover:bg-surface0 hover:text-text',
                )}
              >
                <Icon size={14} aria-hidden="true" className="shrink-0" />
                {t(`categories.${id}`)}
              </button>
            );
          })}
        </nav>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-6 py-4">
            <h1 className="text-text text-lg font-semibold mb-1">
              {t(`categories.${current.id}`)}
            </h1>
            <Page />
          </div>
        </div>
      </div>
    </div>
  );
}
