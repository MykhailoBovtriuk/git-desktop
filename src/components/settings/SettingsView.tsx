import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useUiStore } from '../../stores/ui-store';
import {
  AUTO_REFRESH_OPTIONS,
  LANGUAGES,
  useSettingsStore,
  type AutoRefreshMs,
  type Language,
} from '../../stores/settings-store';
import { PageHeader } from '../layout/PageHeader';
import { SettingsSection } from './SettingsSection';
import { AccountsSection } from './AccountsSection';
import { SegmentedControl } from '../../shared/ui';
import type { ThemePreference } from '../../types';

const THEMES: ThemePreference[] = ['light', 'dark', 'system'];

export function SettingsView() {
  const { t, i18n } = useTranslation('settings');
  const closeOverlayView = useUiStore(s => s.closeOverlayView);
  const overlayBack = useUiStore(s => s.overlayBack);
  const { theme, setTheme, autoRefreshMs, setAutoRefreshMs } = useSettingsStore(
    useShallow(s => ({
      theme: s.theme,
      setTheme: s.setTheme,
      autoRefreshMs: s.autoRefreshMs,
      setAutoRefreshMs: s.setAutoRefreshMs,
    })),
  );

  // i18next owns the language (and its persistence), so read it straight from
  // the instance instead of mirroring it into the settings store.
  const language = (LANGUAGES.find(l => i18n.resolvedLanguage === l) ?? 'en') as Language;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-base">
      <PageHeader
        crumbs={[{ label: t('title') }]}
        onBack={overlayBack}
        onClose={closeOverlayView}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-2">
          <SettingsSection title={t('theme')} description={t('themeHint')}>
            <SegmentedControl
              label={t('theme')}
              value={theme}
              onChange={setTheme}
              options={THEMES.map(value => ({ value, label: t(`themes.${value}`) }))}
            />
          </SettingsSection>

          <SettingsSection title={t('language')} description={t('languageHint')}>
            <SegmentedControl
              label={t('language')}
              value={language}
              onChange={(value: Language) => void i18n.changeLanguage(value)}
              options={LANGUAGES.map(value => ({ value, label: t(`languages.${value}`) }))}
            />
          </SettingsSection>

          <SettingsSection title={t('autoRefresh')} description={t('autoRefreshHint')}>
            <SegmentedControl
              label={t('autoRefresh')}
              value={autoRefreshMs}
              onChange={(value: AutoRefreshMs) => setAutoRefreshMs(value)}
              options={AUTO_REFRESH_OPTIONS.map(value => ({
                value,
                label: value === 0 ? t('off') : t('seconds', { count: value / 1000 }),
              }))}
            />
          </SettingsSection>

          <AccountsSection />
        </div>
      </div>
    </div>
  );
}
