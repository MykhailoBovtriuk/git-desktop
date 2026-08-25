import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { Breadcrumbs, CloseIcon, IconButton, type Crumb } from '../../shared/ui';

interface PageHeaderProps {
  crumbs: Crumb[];
  /** One level up: the screen below this one, or out when there is none. */
  onBack: () => void;
  /** Leaves the overlay entirely, back to the repository. */
  onClose: () => void;
  children?: ReactNode;
}

export function PageHeader({ crumbs, onBack, onClose, children }: PageHeaderProps) {
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

      <div className="ml-auto shrink-0 flex items-center gap-1">
        {children}
        <IconButton icon={CloseIcon} onClick={onClose} aria-label={t('close')} title={t('close')} />
      </div>
    </div>
  );
}
