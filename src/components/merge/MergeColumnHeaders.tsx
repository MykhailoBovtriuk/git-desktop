import { useTranslation } from 'react-i18next';
import type { Choice } from '../../lib/merge-conflicts';

const colHead = 'flex-1 flex items-center justify-between px-3 py-1';

interface MergeColumnHeadersProps {
  targetBranch: string;
  sourceBranch: string;
  onAll: (choice: Choice) => void;
}

export function MergeColumnHeaders({ targetBranch, sourceBranch, onAll }: MergeColumnHeadersProps) {
  const { t } = useTranslation('merge');
  return (
    <div className="flex bg-mantle border-b border-surface0 text-xs shrink-0">
      <div className={`${colHead} text-blue`}>
        <span>{t('currentBranch', { branch: targetBranch })}</span>
        <button onClick={() => onAll('ours')} className="underline text-subtext hover:text-text">
          {t('useThis')}
        </button>
      </div>
      <div className="w-9 shrink-0" />
      <div className={`${colHead} text-text`}>
        <span>{t('resultUpper')}</span>
        <div className="flex gap-3">
          <button onClick={() => onAll('both')} className="underline text-subtext hover:text-text">
            {t('both')}
          </button>
          <button onClick={() => onAll(null)} className="underline text-subtext hover:text-text">
            {t('reset')}
          </button>
        </div>
      </div>
      <div className="w-9 shrink-0" />
      <div className={`${colHead} text-green`}>
        <span>{t('incomingBranch', { branch: sourceBranch })}</span>
        <button onClick={() => onAll('theirs')} className="underline text-subtext hover:text-text">
          {t('useThis')}
        </button>
      </div>
    </div>
  );
}
