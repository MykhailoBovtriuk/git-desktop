import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useShallow } from 'zustand/react/shallow';
import { useUiStore } from '../../stores/ui-store';
import { PageHeader } from '../layout/PageHeader';
import { AuthSettings } from './AuthSettings';
import { IdentitySection } from './IdentitySection';

export function AccountView() {
  const { t } = useTranslation('settings');
  const { closeOverlayView, overlayBack, openOverlayView, consumeSettingsFocus } = useUiStore(
    useShallow(s => ({
      closeOverlayView: s.closeOverlayView,
      overlayBack: s.overlayBack,
      openOverlayView: s.openOverlayView,
      consumeSettingsFocus: s.consumeSettingsFocus,
    })),
  );
  const [authExpanded, setAuthExpanded] = useState(false);

  // Arriving from a failed push: the details are what the user came for.
  useEffect(() => {
    if (consumeSettingsFocus() === 'auth') setAuthExpanded(true);
  }, [consumeSettingsFocus]);

  return (
    <div className="h-full flex flex-col overflow-hidden bg-base">
      <PageHeader
        onBack={overlayBack}
        onClose={closeOverlayView}
        crumbs={[
          { label: t('title'), onClick: () => openOverlayView('settings') },
          { label: t('account.title') },
        ]}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-2">
          <section className="border-b border-surface0 py-4">
            <h2 className="text-text text-sm font-medium">{t('identity.title')}</h2>
            <p className="text-subtext text-xs mt-0.5 mb-3">{t('identity.sectionHint')}</p>
            <IdentitySection />
          </section>

          <section className="py-4">
            <h2 className="text-text text-sm font-medium">{t('auth.title')}</h2>
            <p className="text-subtext text-xs mt-0.5 mb-3">{t('auth.hint')}</p>
            <AuthSettings defaultExpanded={authExpanded} />
          </section>
        </div>
      </div>
    </div>
  );
}
