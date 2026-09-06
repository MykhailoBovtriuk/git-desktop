import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ContextMenu, MenuItem } from '../../shared/ui';

interface BranchItemProps {
  name: string;
  current: boolean;
  isRemote: boolean;
  contextOpen: boolean;
  onToggleContext: () => void;
  onCheckout: () => void;
  onMerge: () => void;
  onRebase: () => void;
  onDelete: () => void;
}

export function BranchItem({
  name,
  current,
  isRemote,
  contextOpen,
  onToggleContext,
  onCheckout,
  onMerge,
  onRebase,
  onDelete,
}: BranchItemProps) {
  const { t } = useTranslation('branches');
  const btnRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="relative">
      <div className="flex items-center justify-between w-full px-2 py-1.5 rounded hover:bg-surface1 text-sm">
        <button
          onClick={() => !current && onCheckout()}
          className="flex items-center gap-2 flex-1 min-w-0 text-left"
        >
          {/* Only the current branch earns the accent — a blue dot on every
              row was an indicator carrying no information. */}
          <span className={current ? 'text-blue' : 'text-subtext'}>{isRemote ? '○' : '●'}</span>
          <span className="text-text truncate max-w-40">{name}</span>
        </button>
        {current && <span className="text-blue text-xs">✓</span>}
        <button
          ref={btnRef}
          onClick={e => {
            e.stopPropagation();
            onToggleContext();
          }}
          className="ml-2 px-1 text-subtext hover:text-text"
          aria-label={t('moreActions')}
        >
          ⋯
        </button>
      </div>

      <ContextMenu open={contextOpen} anchorRef={btnRef} height={152}>
        <MenuItem onClick={onCheckout}>{t('checkout')}</MenuItem>
        <MenuItem onClick={onMerge}>{t('mergeIntoCurrent')}</MenuItem>
        <MenuItem onClick={onRebase}>{t('rebaseOntoCurrent')}</MenuItem>
        {!current && (
          <>
            <div className="border-t border-surface2 my-1" />
            <MenuItem tone="danger" onClick={onDelete}>
              {isRemote ? t('deleteRemoteBranch') : t('deleteBranch')}
            </MenuItem>
          </>
        )}
      </ContextMenu>
    </div>
  );
}
