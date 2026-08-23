import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  onBack: () => void;
  children?: ReactNode;
}

export function PageHeader({ title, onBack, children }: PageHeaderProps) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-surface0 shrink-0">
      <button onClick={onBack} className="text-blue text-xs hover:underline">
        ← {t('back')}
      </button>
      <h1 className="text-text text-sm font-semibold">{title}</h1>
      {children}
    </div>
  );
}
