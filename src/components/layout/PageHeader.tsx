import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { Breadcrumbs, type Crumb } from '../../shared/ui';

interface PageHeaderProps {
  crumbs: Crumb[];
  /**
   * One level up: the screen below this one, or out when there is none — which
   * makes it the only way out, now that the header no longer carries a second
   * one. Two controls for leaving the same screen was a choice with nothing at
   * stake either way.
   */
  onBack: () => void;
  /** Actions belonging to this screen, shown at the right of the header. */
  children?: ReactNode;
}

export function PageHeader({ crumbs, onBack, children }: PageHeaderProps) {
  const { t } = useTranslation();
  return (
    <div className="relative flex items-center px-4 py-2 border-b border-surface0 shrink-0">
      <button onClick={onBack} className="text-blue text-xs hover:underline shrink-0">
        ← {t('back')}
      </button>

      {/* Centred on the window rather than on the space left of the back
          button, so the crumbs do not shift as that label changes length
          between languages. */}
      <Breadcrumbs crumbs={crumbs} className="absolute left-1/2 -translate-x-1/2 max-w-[60%]" />

      <div className="ml-auto shrink-0 flex items-center gap-1">{children}</div>
    </div>
  );
}
