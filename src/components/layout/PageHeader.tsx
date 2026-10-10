import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { Breadcrumbs, type Crumb } from '../../shared/ui';

interface PageHeaderProps {
  crumbs: Crumb[];
  /**
   * One level up: the screen below this one, or out when there is none. Left
   * out where the titlebar's own toggle already closes the page.
   */
  onBack?: () => void;
  /** Actions belonging to this screen, shown at the right of the header. */
  children?: ReactNode;
}

export function PageHeader({ crumbs, onBack, children }: PageHeaderProps) {
  const { t } = useTranslation();
  return (
    // The crumbs are absolutely centred and give the row no height; without the
    // back link it would collapse, so it keeps the height that link gave it.
    <div className="relative flex items-center min-h-8 px-4 py-2 border-b border-surface0 shrink-0">
      {onBack && (
        <button onClick={onBack} className="text-blue text-xs hover:underline shrink-0">
          ← {t('back')}
        </button>
      )}

      {/* Centred on the window so the crumbs do not shift with the back label's
          length. */}
      <Breadcrumbs crumbs={crumbs} className="absolute left-1/2 -translate-x-1/2 max-w-[60%]" />

      <div className="ml-auto shrink-0 flex items-center gap-1">{children}</div>
    </div>
  );
}
